import { motion, useMotionValue, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { LumiEyes, type LumiGaze } from './LumiEyes';
import { LumiMouth } from './LumiMouth';
import type { LumiRig } from './lumi-rig';

const CANVAS = 512;
/** Grid resolution of the warp mesh — fine enough that the bend reads as a smooth curve. */
const GRID = 32;
/** Above/below the chin line (px, 512 canvas): the art goes from fully head-driven to fully still across this band. */
const BEND_ABOVE = 55;
const BEND_BELOW = 26;
/** Resting feet line the chest breathes up from. */
const FEET_Y = 466;
const BREATH_AMOUNT = 0.014;
const BREATH_SECONDS = 3.6;
/** One full walk cycle (left step + right step), seconds. */
const WALK_CYCLE_SECONDS = 0.56;
/** Walk cycle size, 512-canvas px / radians. */
const WALK = { footLift: 11, armSwing: 6, bob: 3, sway: 0.045, lean: 0.06 };

/** Head pose, already in canvas units: rotation (deg) and shift (px of the 512 canvas). */
export interface LumiHeadPose {
  rotate: MotionValue<number>;
  shiftX: MotionValue<number>;
  shiftY: MotionValue<number>;
}

const VERTEX = `#version 300 es
in vec2 a_uv;
uniform vec2 u_pivot;
uniform float u_cut;
uniform float u_above;
uniform float u_below;
uniform float u_theta;
uniform vec2 u_shift;
uniform float u_breath;
uniform float u_feet;
uniform float u_walk;   // 0..1 blend into the walk cycle
uniform float u_phase;  // walk cycle phase, radians
uniform float u_lean;   // lean toward the direction of travel, radians
uniform vec3 u_legs;    // hipY, soleY, splitX
uniform vec4 u_arms;    // leftX, rightX, topY, bottomY
out vec2 v_uv;
vec2 rotateAround(vec2 p, vec2 origin, float angle) {
  vec2 d = p - origin;
  return origin + vec2(d.x * cos(angle) - d.y * sin(angle), d.x * sin(angle) + d.y * cos(angle));
}
void main() {
  vec2 rest = a_uv * ${CANVAS.toFixed(1)};
  vec2 p = rest;
  // 1 on the head, 0 on the body, easing smoothly across the chin.
  float w = 1.0 - smoothstep(u_cut - u_above, u_cut + u_below, p.y);
  // Breathing: the chest stretches up from the feet and the head rides on top.
  float lift = (u_cut - u_feet) * u_breath;
  p.y += (1.0 - w) * (p.y - u_feet) * u_breath + w * lift;
  vec2 pivot = u_pivot + vec2(0.0, lift);
  p = rotateAround(p, pivot, u_theta * w) + u_shift * w;

  if (u_walk > 0.0) {
    float s = sin(u_phase);
    // Feet lift one after the other; the leg bends from hip to sole. The
    // ground shadow drawn under the soles stays planted.
    float legRamp = smoothstep(u_legs.x, u_legs.y - 8.0, rest.y);
    float leg = legRamp * (1.0 - smoothstep(u_legs.y - 1.0, u_legs.y + 4.0, rest.y));
    float rightSide = smoothstep(u_legs.z - 6.0, u_legs.z + 6.0, rest.x);
    float lift = mix(max(0.0, s), max(0.0, -s), rightSide);
    p.y -= lift * ${WALK.footLift.toFixed(1)} * leg * u_walk;
    // Arms swing opposite to the legs.
    float armBand = smoothstep(u_arms.z, u_arms.z + 20.0, rest.y) * (1.0 - smoothstep(u_arms.w, u_arms.w + 10.0, rest.y));
    float leftArm = clamp((u_arms.x - rest.x) / 30.0, 0.0, 1.0);
    float rightArm = clamp((rest.x - u_arms.y) / 30.0, 0.0, 1.0);
    p.y -= (leftArm * max(0.0, -s) + rightArm * max(0.0, s)) * ${WALK.armSwing.toFixed(1)} * armBand * u_walk;
    // The body sways onto the planted foot, rises on each step and leans into travel.
    float upper = 1.0 - legRamp;
    p = rotateAround(p, vec2(u_legs.z, u_legs.y), (s * ${WALK.sway.toFixed(3)} * u_walk + u_lean) * upper);
    p.y -= abs(s) * ${WALK.bob.toFixed(1)} * u_walk * upper;
  }
  v_uv = a_uv;
  gl_Position = vec4(p.x / ${CANVAS.toFixed(1)} * 2.0 - 1.0, 1.0 - p.y / ${CANVAS.toFixed(1)} * 2.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 color;
void main() { color = texture(u_tex, v_uv); }`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Lumi mesh shader failed', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function buildGrid() {
  const uvs: number[] = [];
  for (let y = 0; y <= GRID; y += 1) {
    for (let x = 0; x <= GRID; x += 1) uvs.push(x / GRID, y / GRID);
  }
  const indices: number[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const i = y * (GRID + 1) + x;
      indices.push(i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1);
    }
  }
  return { uvs: new Float32Array(uvs), indices: new Uint16Array(indices) };
}

interface LumiMeshProps {
  src: string;
  rig: LumiRig & { head: NonNullable<LumiRig['head']> };
  pose: LumiHeadPose;
  breathing: boolean;
  /** Walking (standing pose with a walk rig only) and which way: -1 left, 1 right, 0 in place. */
  walking: boolean;
  walkDirection: number;
  /** Swap the drawn mouth for a wider smile — used while walking (neutral's resting mouth reads flat in motion). */
  smiling?: boolean;
  reduceMotion?: boolean;
  gaze?: LumiGaze;
  /** Called when WebGL is unavailable so the caller can show the flat image instead. */
  onUnsupported: () => void;
}

/**
 * Renders Lumi's artwork on a warp mesh so the head can turn on its own:
 * points above the chin follow the head pose, points below stay still, and
 * the band in between bends smoothly — nothing is cut, so ears, tails and
 * paws near the face stretch a little instead of tearing. The eye rig rides
 * on the head with the same rigid transform (eyes sit well inside the
 * fully-head-driven zone).
 */
export function LumiMesh({ src, rig, pose, breathing, walking, walkDirection, smiling = false, reduceMotion = false, gaze, onUnsupported }: LumiMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  // Rigid transform for the eye overlay, mirroring the shader's head zone.
  const eyeX = useMotionValue('0%');
  const eyeY = useMotionValue('0%');
  const eyeRotate = useMotionValue(0);
  // Body transform of the walk cycle, for the eye overlay (see the shader).
  const bodyY = useMotionValue('0%');
  const bodyRotate = useMotionValue(0);
  const breathingRef = useRef(breathing);
  breathingRef.current = breathing;
  const walkRef = useRef({ walking, walkDirection });
  walkRef.current = { walking: walking && Boolean(rig.walk), walkDirection };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!canvas || !gl) {
      onUnsupported();
      return;
    }
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      onUnsupported();
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Lumi mesh program failed', gl.getProgramInfoLog(program));
      onUnsupported();
      return;
    }
    gl.useProgram(program);

    const { uvs, indices } = buildGrid();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    const uvLocation = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      pivot: uniform('u_pivot'), cut: uniform('u_cut'), above: uniform('u_above'), below: uniform('u_below'),
      theta: uniform('u_theta'), shift: uniform('u_shift'), breath: uniform('u_breath'), feet: uniform('u_feet'),
      walk: uniform('u_walk'), phase: uniform('u_phase'), lean: uniform('u_lean'), legs: uniform('u_legs'), arms: uniform('u_arms'),
    };
    const legs = rig.walk;
    if (legs) {
      gl.uniform3f(u.legs, legs.hipY, legs.soleY, legs.splitX);
      gl.uniform4f(u.arms, legs.armLeftX, legs.armRightX, legs.armTopY, legs.armBottomY);
    }
    gl.uniform2f(u.pivot, rig.head.pivotX, rig.head.pivotY);
    gl.uniform1f(u.cut, rig.head.pivotY);
    gl.uniform1f(u.above, BEND_ABOVE);
    gl.uniform1f(u.below, BEND_BELOW);
    gl.uniform1f(u.feet, FEET_Y);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const texture = gl.createTexture();
    let textureReady = false;
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textureReady = true;
      setReady(true);
    };
    image.src = src;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    const started = performance.now();
    let last = started;
    let walkAmount = 0;
    let lean = 0;
    let phase = 0;
    const draw = (now: number) => {
      frame = window.requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!textureReady) return;
      // Ease in and out of the walk so starting/stopping never snaps.
      const target = walkRef.current;
      const ease = Math.min(1, dt * 10);
      walkAmount += ((target.walking ? 1 : 0) - walkAmount) * ease;
      lean += ((target.walking ? target.walkDirection * WALK.lean : 0) - lean) * ease;
      if (walkAmount > 0.001) phase += (dt / WALK_CYCLE_SECONDS) * Math.PI * 2;
      else phase = 0;
      const theta = (pose.rotate.get() * Math.PI) / 180;
      const shiftX = pose.shiftX.get();
      const shiftY = pose.shiftY.get();
      const breathPhase = ((now - started) / 1000 / BREATH_SECONDS) * Math.PI * 2;
      const breath = breathingRef.current ? BREATH_AMOUNT * 0.5 * (1 - Math.cos(breathPhase)) : 0;
      const lift = (rig.head.pivotY - FEET_Y) * breath;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.theta, theta);
      gl.uniform2f(u.shift, shiftX, shiftY);
      gl.uniform1f(u.breath, breath);
      gl.uniform1f(u.walk, legs ? walkAmount : 0);
      gl.uniform1f(u.phase, phase);
      gl.uniform1f(u.lean, lean);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      eyeX.set(`${(shiftX / CANVAS) * 100}%`);
      eyeY.set(`${((shiftY + lift) / CANVAS) * 100}%`);
      eyeRotate.set(pose.rotate.get());
      const step = Math.sin(phase);
      const walkBlend = legs ? walkAmount : 0;
      bodyRotate.set(((step * WALK.sway * walkBlend + lean) * 180) / Math.PI);
      bodyY.set(`${((-Math.abs(step) * WALK.bob * walkBlend) / CANVAS) * 100}%`);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(uvBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // The rig and pose objects are stable per expression; src identifies the art.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {ready && rig.eyes.length ? (
        <motion.span
          className="absolute inset-0"
          style={{
            y: bodyY,
            rotate: bodyRotate,
            originX: (rig.walk?.splitX ?? CANVAS / 2) / CANVAS,
            originY: (rig.walk?.soleY ?? FEET_Y) / CANVAS,
          }}
        >
          <motion.span
            className="absolute inset-0"
            style={{ x: eyeX, y: eyeY, rotate: eyeRotate, originX: rig.head.pivotX / CANVAS, originY: rig.head.pivotY / CANVAS }}
          >
            <LumiEyes src={src} rig={rig} gaze={gaze} />
            <LumiMouth active={smiling} reduceMotion={reduceMotion} />
          </motion.span>
        </motion.span>
      ) : null}
    </>
  );
}

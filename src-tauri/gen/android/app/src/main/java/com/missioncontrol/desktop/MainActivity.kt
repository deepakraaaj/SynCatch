package com.missioncontrol.desktop

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Android 15+ always draws apps edge-to-edge. Keep the WebView between the
    // system bars so the phone owns the status bar, nav bar and their colours,
    // and shrink it above the keyboard like adjustResize used to.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(android.R.id.content)) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = maxOf(bars.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
  }
}

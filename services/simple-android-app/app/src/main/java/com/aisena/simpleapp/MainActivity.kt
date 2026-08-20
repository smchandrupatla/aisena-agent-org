package com.aisena.simpleapp

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    companion object {
        // Single source of truth for the on-screen text, shared with the unit test.
        const val DISPLAY_TEXT = "test"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        findViewById<TextView>(R.id.mainText).text = DISPLAY_TEXT
    }
}

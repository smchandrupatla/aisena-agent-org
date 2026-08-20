package com.aisena.simpleapp

import android.widget.TextView
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MainActivityRobolectricTest {

    @Test
    fun onCreate_rendersDisplayTextInTheVisibleTextView() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()

        val textView = activity.findViewById<TextView>(R.id.mainText)

        assertEquals("test", textView.text.toString())
        assertEquals(android.view.View.VISIBLE, textView.visibility)
    }
}

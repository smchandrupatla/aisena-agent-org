package com.aisena.simpleapp

import org.junit.Assert.assertEquals
import org.junit.Test

class MainActivityUnitTest {

    @Test
    fun displayText_isExactlyTest() {
        assertEquals("test", MainActivity.DISPLAY_TEXT)
    }
}

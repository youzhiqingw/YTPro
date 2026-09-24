package com.google.android.youtube.pro.webview;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collection;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;

/**
 * Regression tests for {@link WebAppInterface#safeFileName(String)}.
 *
 * <p>This method is the single sanitization point on the JS→Java bridge boundary
 * for every file written under {@code Downloads/YTPRO}: it is called by
 * {@code requestBinaryPort} and {@code muxVideoAudio} (3 call sites). A regression
 * here re-opens a path-traversal sink flagged by the mimosa scan (finding:
 * requestBinaryPort → openStreamForFile, CWE-class path-traversal).</p>
 *
 * <p>The method is {@code private static} on purpose — the test reaches it via
 * reflection so production visibility is not widened just for testability.
 * Per the {@code doubao-coding-develop-unit-tests} skill contract, only test
 * files are added; no production code is changed.</p>
 *
 * <p>Design follows contract → counter-example → evidence. The contract is:
 * (1) result never contains {@code /} or {@code \}; (2) result is non-empty
 * (defaults to {@code ytpro.bin}); (3) result has no leading {@code .}.
 * Each parameter row is a distinct counter-example that fails against a
 * specific wrong implementation. Row 1 (path traversal) is the tracer.</p>
 */
@RunWith(Parameterized.class)
public class SafeFileNameTest {

    @Parameters(name = "{index}: {0}")
    public static Collection<Object[]> data() {
        return Arrays.asList(new Object[][] {
            // T1 (tracer) — kills: impl that skips replaceAll entirely.
            // Trace: "../../etc/passwd"
            //   replaceAll("[/\\\\]","_") → ".._.._etc_passwd"
            //   while loop strips ALL leading dots ("..") → "_.._etc_passwd"
            //   trim → "_.._etc_passwd"
            // Key invariant: no '/' or '\' in output (security-critical).
            { "../../etc/passwd",         "_.._etc_passwd" },
            // T2 — kills: impl that strips only '/' but not '\\'
            // Same trace: "..\..\windows\system32"
            //   replaceAll → ".._.._windows_system32" → strip ".." → "_.._windows_system32"
            { "..\\..\\windows\\system32","_.._windows_system32" },
            // T3 — kills: impl that forgets to strip leading dots
            { "....hidden",               "hidden" },
            // T4 — kills: impl that throws NPE on null
            { null,                       "ytpro.bin" },
            // T5 — kills: impl that returns "" for blank input
            { "",                         "ytpro.bin" },
            { "   ",                      "ytpro.bin" },
            // T6 — kills: impl missing the final empty-after-sanitize fallback.
            // Trace: "../.."
            //   replaceAll("[/\\\\]","_") → ".._.."
            //   while loop strips leading ".." → "_.."
            //   trim → "_.."
            //   non-empty → returned as-is (NOT "ytpro.bin")
            { "../..",                    "_.." },
            // T7 — kills: impl that over-sanitizes a normal name
            { "video.mp4",                "video.mp4" },
            // T8 — kills: impl that omits .trim()
            { "  video.mp4  ",            "video.mp4" },
        });
    }

    private final String input;
    private final String expected;

    public SafeFileNameTest(String input, String expected) {
        this.input = input;
        this.expected = expected;
    }

    @Test
    public void sanitize() throws Exception {
        String result = invokeSafeFileName(input);
        assertEquals(expected, result);
    }

    /**
     * Security invariant: the sanitized result must NEVER contain a path
     * separator. This is the property that actually prevents path traversal —
     * "..." sequences without separators are harmless to {@code new File(dir, x)}.
     * Kills: any impl that lets a '/' or '\' through (partial regex, wrong char
     * class, or forgotten pass).
     */
    @Test
    public void noPathSeparatorInAnyOutput() throws Exception {
        String[] traversalInputs = {
            "../../etc/passwd",
            "..\\..\\windows\\system32",
            "a/b/c/d",
            "a\\b\\c\\d",
            "/etc/passwd",
            "C:\\Windows\\system32",
            "..%2f..%2fetc%2fpasswd",
        };
        for (String input : traversalInputs) {
            String result = invokeSafeFileName(input);
            assertNotNull("null result for: " + input, result);
            assertFalse("result contains '/' for input " + input + ": " + result,
                result.contains("/"));
            assertFalse("result contains '\\' for input " + input + ": " + result,
                result.contains("\\"));
        }
    }

    /** Reach the private static safeFileName via reflection — no visibility change. */
    private static String invokeSafeFileName(String name) throws Exception {
        Method m = WebAppInterface.class.getDeclaredMethod("safeFileName", String.class);
        m.setAccessible(true);
        return (String) m.invoke(null, name);
    }
}

# Isolated LCD queue regression tests

Run `node --test tests/lcd-queue.test.cjs` with an already installed Node.js 18+.
No package install is needed. CI uses the Node.js already on its hosted runner.

The tests execute the actual `EyeHelperPosition/lcd.js` queue methods with
minimal deterministic Q, mraa, and timer substitutes. They cover terminal delays,
multiple waits and commands, repeated callers, timing-unit conversion, success,
write-status and thrown errors, error clearing/resuming, and global isolation.
They do not load native mraa, run application startup, or access I2C hardware.

This queue belongs to the opt-in JavaScript LCD sample. The application's default
UPM path is unchanged. Production syntax remains compatible with its declared
Node >=0.10 baseline; the modern Node requirement belongs only to the host tests.
The tests do not validate actual Q/native packages, Intel Edison hardware, LCD
timing or output, or the Windows 8.1 / Phone client. Existing dependency ranges
remain unchanged and require a separate supported-platform revival decision.

// Drive the Grive RGB LCD (a JHD1313m1)
// We can do this in either of two ways
//
// The bext way is to use the upm library. which
// contains support for this device
//
// The alternative way is to drive the LCD directly from
// Javascript code using the i2c interface directly
// This approach is useful for learning about using
// the i2c bus. The lcd file is an implementation
// in Javascript for some of the common LCD functions

// configure jshint
/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

// change this to false to use the hand rolled version
var useUpmVersion = true;

// we want mraa to be at least version 0.6.1
var mraa = require('mraa');
var version = mraa.getVersion();

var DeviceControl = {
    display: {
        display: null,
        clearScreen: function () {
            var display = DeviceControl.display.display;
            display.setCursor(1, 1);
            display.write('                 ');
            display.setCursor(0, 0);
            display.write('                  ');
        },
        useUpm: function () {
            var lcd = require('jsupm_i2clcd');
            //DeviceControl.display.display = new lcd.Jhd1313m1(0, 0x3E, 0x62);
            DeviceControl.display.display = new lcd.Jhd1313m1(0, 0x3E, 0x62);
            //touchSensor.Jhd1313m1_I2C_BUS, touchSensor.Jhd1313m1_DEFAULT_I2C_ADDR
            DeviceControl.display.display.setCursor(1, 1);
            DeviceControl.display.display.setCursor(0, 0);
        },
        useLcd: function () {
            var lcd = require('./lcd');
            DeviceControl.display.display = new lcd.LCD(0);
            //DeviceControl.display.display.setColor(0, 60, 255);
            DeviceControl.display.display.waitForQuiescent()
            .then(function () {
            })
            .fail(function (err) {
                console.log(err);
                DeviceControl.display.display.clearError();
            });
        },
        setRedColor: function() {
            DeviceControl.display.display.setColor(255, 0, 0);
        },
        setBlueColor: function() {
            DeviceControl.display.display.setColor(0, 0, 255);
        },
        rotateColors: function () {
            var red = 0;
            var green = 0;
            var blue = 0;
            var display = DeviceControl.display.display;
            display.setColor(red, green, blue);
            setInterval(function () {
                blue += 64;
                if (blue > 255) {
                    blue = 0;
                    green += 64;
                    if (green > 255) {
                        green = 0;
                        red += 64;
                        if (red > 255) {
                            red = 0;
                        }
                    }
                }
                display.setColor(red, green, blue);
            }, 1000);
        }
    }
};


if (version >= 'v0.6.1') {
    console.log('mraa version (' + version + ') ok');
}
else {
    console.log('meaa version(' + version + ') is old - this code may not work');
}

if (useUpmVersion) {
    DeviceControl.display.useUpm();
}
else {
    DeviceControl.display.useLcd();
}

// Инициализируем D2 вывод как цифровой выход
var myOnboardLed = new mraa.Gpio(4);
var myBuzzer = new mraa.Gpio(3);

// Настроим на вывод
myOnboardLed.dir(mraa.DIR_OUT);
var ledState = true; //Текущее состояние светодиода

myBuzzer.dir(mraa.DIR_OUT);
var buzzerState = true;

//RFR359F
//var distance1 = new mraa.Gpio(2);
var distance = require('jsupm_rfr359f');
var distance1 = new distance.RFR359F(2);
var previousDistance1 = false;

var touchSensor = require('jsupm_mpr121');

//var myTouchSensor = new touchSensor.MPR121(touchSensor.MPR121_I2C_BUS, touchSensor.MPR121_DEFAULT_I2C_ADDR);
//myTouchSensor.configAN3944();
console.log(touchSensor.MPR121_I2C_BUS);
console.log(touchSensor.MPR121_DEFAULT_I2C_ADDR);

setInterval(function () {
    //myTouchSensor.readButtons();
    //printButtons(myTouchSensor);
}, 1000);

function printButtons(touchSensor) {
    var buttonPressed = false;

    var outputStr = "Buttons Pressed: ";
    for (var i = 0; i < 12; i++) {
        if (touchSensor.m_buttonStates & (1 << i)) {
            outputStr += (i + " ");
            buttonPressed = true;
        }
    }

    if (!buttonPressed)
        outputStr += "None";

    console.log(outputStr);

    if (touchSensor.m_overCurrentFault)
        console.log("Over Current Fault detected!");
}

// Будем вызывать функцию через каждые 100 мс
setInterval(periodicLightActivity, 50);
setInterval(periodicBuzzerActivity, 100);

var digital_pin_D2 = new mraa.Gpio(8);
digital_pin_D2.dir(mraa.DIR_IN);

function periodicLightActivity() {
    myOnboardLed.write(ledState ? 1 : 0); // установим сигнал по состоянию
    ledState = !ledState; // изменим состояние на обратное   

    DeviceControl.display.display.setCursor(0, 0);

    if (previousDistance1 !== distance1.objectDetected()) {
        DeviceControl.display.clearScreen();
    }

    if (distance1.objectDetected()) {
        DeviceControl.display.display.write("detected");
        periodicBuzzerActivity(1);

        DeviceControl.display.setRedColor();

        DeviceControl.display.display.setCursor(0, 1);

        //var analogPin0 = new mraa.Aio(2); //setup access analog input Analog pin #0 (A0)
        //var analogValue = analogPin0.read(); //read the value of the analog pin
        //console.log(digital_pin_D2.read()); //write the value of the analog pin to the console
        var touch_sensor_value = digital_pin_D2.read();
        console.log(touch_sensor_value);
        //DeviceControl.display.display.write(touch_sensor_value);
    }
    else {
        periodicBuzzerActivity(0);
        DeviceControl.display.display.write("none");
        DeviceControl.display.setBlueColor();
    }

    previousDistance1 = distance1.objectDetected();
}

function periodicBuzzerActivity(manual) {
    if ((manual === null) && (manual === undefined)) {
        myBuzzer.write(buzzerState ? 1 : 0); // установим сигнал по состоянию
        //buzzerState = !buzzerState; // изменим состояние на обратное
    } else {
        buzzerState = manual;
        myBuzzer.write(manual ? 1 : 0);
    }
}


var exit = function (process) {
    periodicBuzzerActivity(0);

    console.log("Exiting...");
    process.exit(0);
};

//process.on('SIGINT', function () {
//    exit(process);
//});

process.on('exit', function () {
    exit(process);
});
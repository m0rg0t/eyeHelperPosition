var express = require('express');
var app = express();
var path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var unirest = require('unirest');


// configure jshint
/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

// change this to false to use the hand rolled version
var useUpmVersion = true;

// we want mraa to be at least version 0.6.1
var mraa = require('mraa');
var version = mraa.getVersion();



var InfoControl = {
    mac: "", //intel edison mac address
    init: function () {
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

        DeviceControl.distance.firstDistance.__proto__ = distanceProto;
        DeviceControl.distance.firstDistance.init();

        DeviceControl.distance.secondDistance.__proto__ = distanceProto;
        DeviceControl.distance.secondDistance.init(7);

        // Будем вызывать функцию через каждые 100 мс
        setInterval(periodicLightActivity, 50);
        setInterval(DeviceControl.buzzer.periodicBuzzerActivity, 100);
        setInterval(DeviceControl.buzzer.periodicMainBuzzerActivity, 2000);

        DeviceControl.touchButton.init();
        DeviceControl.redLed.init();
        DeviceControl.buzzer.init();        
    },
    statistics: {
        tick: 10,
        sendStat: function (statItem) {
            unirest.post('https://eyehelperposition.azure-mobile.net/tables/Statistic')
              .header({ "Accept": "application/json", "X-ZUMO-APPLICATION": 'omWGsXHwcNMFGeFxZgTuWsbCLKqCLg20' })
              .send(statItem)
              .end(function (response) {
                  console.log(response.body);
              });
        },
        interval: null,
        createItem: function (duration, pressed) {
            if (InfoControl.statistics.item === null) {
                if ((pressed === undefined) || (pressed === null)) {
                    pressed = false;
                }
                InfoControl.statistics.item = { "duration": duration, "pressed": pressed, "deviceId": InfoControl.mac };
                console.log("InfoControl.statistics.item", InfoControl.statistics.item);
                //InfoControl.statistics.createItem(0, DeviceControl.touchButton.getValue());
                InfoControl.statistics.interval = setInterval(InfoControl.statistics.updateItem, InfoControl.statistics.tick);
            }
        },
        updateItem: function () {
            InfoControl.statistics.item.duration += InfoControl.statistics.tick;
            if (DeviceControl.touchButton.getValue() == 1) {
                InfoControl.statistics.item.pressed = 1;
            }
        },
        stopUpdateItem: function() {
            clearInterval(InfoControl.statistics.interval);
            var date = new Date();
            InfoControl.statistics.item.created = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear() + " " + date.getHours() + ":00";
            InfoControl.statistics.sendStat(InfoControl.statistics.item);
            InfoControl.statistics.item = null;
        },
        item: null
    }
};

var distanceProto = {
    distance: null,
    init: function (id) {
        if ((id === null) || (id === undefined)) {
            id = 2;
        }
        var distanceInit = require('jsupm_rfr359f');
        this.distance = new distanceInit.RFR359F(id);
        this.previousDistance = false;
    },
    previousDistance: false
};

var DeviceControl = {
    distance: {
        previousAlreadyDistance: false,
        alreadyDistance: false,
        firstDistance: {},
        secondDistance: {},
        checkDistance: function (distance, detectedText) {
            if ((detectedText === null) || (detectedText === undefined)) {
                detectedText = "detected";
            }

            DeviceControl.display.display.setCursor(0, 0);

            if (distance.previousDistance !== distance.distance.objectDetected()) {
                DeviceControl.display.clearScreen();
            }

            if (distance.distance.objectDetected()) {
                DeviceControl.display.display.write(detectedText);
                DeviceControl.buzzer.periodicBuzzerActivity(1);
                DeviceControl.display.setRedColor();
                DeviceControl.display.display.setCursor(0, 1);

                DeviceControl.distance.alreadyDistance = true;
            }
            else {
                DeviceControl.buzzer.periodicBuzzerActivity(0);
                DeviceControl.display.display.write("none");
                DeviceControl.display.setBlueColor();
            }

            distance.previousDistance = distance.distance.objectDetected();
        }
    },
    buzzer: {
        buzzer: null,
        init: function () {
            DeviceControl.buzzer.buzzer = new mraa.Gpio(3);

            DeviceControl.buzzer.buzzer.dir(mraa.DIR_OUT);
            DeviceControl.buzzer.buzzerState = true;
        },
        buzzState: true,
        periodicBuzzerActivity: function (manual) {
            //manual = 0;
            if ((manual === null) && (manual === undefined)) {
                DeviceControl.buzzer.buzzer.write(DeviceControl.buzzer.buzzerState ? 1 : 0); // установим сигнал по состоянию
                //buzzerState = !buzzerState;
            } else {
                DeviceControl.buzzer.buzzerState = manual;
                DeviceControl.buzzer.buzzer.write(manual ? 1 : 0);
            }
        },
        periodicMainBuzzerActivity: function () {
            DeviceControl.buzzer.periodicBuzzerActivity(1);
            setInterval(function () { DeviceControl.buzzer.periodicBuzzerActivity(0); }, 150);
        }
    },
    redLed: {
        led: null,
        init: function () {
            DeviceControl.redLed.led = new mraa.Gpio(4);
            DeviceControl.redLed.led.dir(mraa.DIR_OUT);
        },
        ledState: true, //Текущее состояние светодиода
    },
    touchButton: {
        //init touch button for reading
        init: function () {
            DeviceControl.touchButton.touchButton = new mraa.Gpio(8);
            DeviceControl.touchButton.touchButton.dir(mraa.DIR_IN);
        },
        getValue: function () {
            var touch_sensor_value = DeviceControl.touchButton.touchButton.read();
            return touch_sensor_value;
        },
        touchButton: null
    },
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
        setRedColor: function () {
            DeviceControl.display.display.setColor(255, 0, 0);
        },
        setGreenColor: function () {
            DeviceControl.display.display.setColor(0, 255, 0);
        },
        setBlueColor: function () {
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

require('getmac').getMac(function (err, macAddress) {
    if (err) { }
    console.log("macAddress", macAddress);
    InfoControl.mac = macAddress;

    InfoControl.init();
});




function periodicLightActivity() {
    DeviceControl.redLed.led.write(DeviceControl.redLed.ledState ? 1 : 0); // установим сигнал по состоянию
    DeviceControl.redLed.ledState = !DeviceControl.redLed.ledState; // изменим состояние на обратное   

    if (DeviceControl.distance.alreadyDistance === false) {
        DeviceControl.distance.checkDistance(DeviceControl.distance.firstDistance, "detect left");
    }
    if (DeviceControl.distance.alreadyDistance === false) {
        DeviceControl.distance.checkDistance(DeviceControl.distance.secondDistance, "detect right");
    }

    if (DeviceControl.touchButton.getValue() == 1) {
        var interval = setInterval(function () { DeviceControl.display.setGreenColor(); }, 10);
        setTimeout(function () {
            clearInterval(interval);
        }, 400);
        DeviceControl.display.setGreenColor();
    }

    //console.log("DeviceControl.distance.alreadyDistance", DeviceControl.distance.alreadyDistance);
    if ((DeviceControl.distance.alreadyDistance) && (DeviceControl.distance.previousAlreadyDistance === false)) {

        DeviceControl.distance.previousAlreadyDistance = true;
        
        InfoControl.statistics.createItem(0, DeviceControl.touchButton.getValue());
    } else {
        if (DeviceControl.distance.previousAlreadyDistance !== DeviceControl.distance.alreadyDistance) {
            InfoControl.statistics.stopUpdateItem(); //(InfoControl.statistics.item);
            DeviceControl.distance.previousAlreadyDistance = false;
        }
    }
    DeviceControl.distance.alreadyDistance = false;
}




/*var exit = function (process) {
    DeviceControl.buzzer.periodicBuzzerActivity(0);
    console.log("Exiting...");
    process.exit(0);
};*/

/*process.on('SIGINT', function () {
    exit(process);
});
process.on('exit', function () {
    exit(process);
});*/


var connectedUsersArray = [];
var userId;

app.get('/', function (req, res) {
    //Join all arguments together and normalize the resulting path.
    res.sendFile(path.join(__dirname + '/client', 'index.html'));
});

//Allow use of files in client folder
app.use(express.static(__dirname + '/client'));
app.use('/client', express.static(__dirname + '/client'));

//Socket.io Event handlers
io.on('connection', function (socket) {
    console.log("\n Add new User: u" + connectedUsersArray.length);
    if (connectedUsersArray.length > 0) {
        var element = connectedUsersArray[connectedUsersArray.length - 1];
        userId = 'u' + (parseInt(element.replace("u", "")) + 1);
    }
    else {
        userId = "u0";
    }
    console.log('a user connected: ' + userId);
    io.emit('user connect', userId);
    connectedUsersArray.push(userId);
    console.log('Number of Users Connected ' + connectedUsersArray.length);
    console.log('User(s) Connected: ' + connectedUsersArray);
    io.emit('connected users', connectedUsersArray);

    socket.on('user disconnect', function (msg) {
        console.log('remove: ' + msg);
        connectedUsersArray.splice(connectedUsersArray.lastIndexOf(msg), 1);
        io.emit('user disconnect', msg);
    });

    socket.on('chat message', function (msg) {
        io.emit('chat message', msg);
        console.log('message: ' + msg.value);
    });

    socket.on('toogle led', function (msg) {
        //myOnboardLed.write(ledState ? 1 : 0); //if ledState is true then write a '1' (high) otherwise write a '0' (low)
        msg.value = DeviceControl.redLed.ledState;
        io.emit('toogle led', msg);
        DeviceControl.redLed.ledState = !DeviceControl.redLed.ledState; //invert the ledState
    });

});


http.listen(3000, function () {
    console.log('Web server Active listening on *:3000');
});
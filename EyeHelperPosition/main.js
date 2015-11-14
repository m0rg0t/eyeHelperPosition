var express = require('express');
var app = express();
var path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var querystring = require('querystring');
var unirest = require('unirest');

function PostCode(codestring) {
    
  unirest.post('https://eyehelperposition.azure-mobile.net/tables/Statistic')
    .header({"Accept": "application/json", "X-ZUMO-APPLICATION": 'SJfSYDKpwxSnFpbksyCchOlVkuUIHe74'})
    .send({ "text": "Hello World!" })
    .end(function (response) {
      console.log(response.body);
    });

  /*  
  // Build the post string from an object
  var post_data = querystring.stringify({
      'compilation_level' : 'ADVANCED_OPTIMIZATIONS',
      'output_format': 'json',
      'output_info': 'compiled_code',
        'warning_level' : 'QUIET',
        'js_code' : codestring
  });

  // An object of options to indicate where to post to
  var post_options = {
      host: 'eyehelperposition.azure-mobile.net',
      port: '81',
      path: '/tables/Service',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(post_data),
          'X-ZUMO-APPLICATION': 'omWGsXHwcNMFGeFxZgTuWsbCLKqCLg20'
      }
  };

  // Set up the request
  var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });

  // post the data
  post_req.write(post_data);
  post_req.end();*/

}

// configure jshint
/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

// change this to false to use the hand rolled version
var useUpmVersion = true;

// we want mraa to be at least version 0.6.1
var mraa = require('mraa');
var version = mraa.getVersion();

PostCode(1);

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

var distance = require('jsupm_rfr359f');
var distance1 = new distance.RFR359F(2);
var previousDistance1 = false;

//TODO: find way to work with 4 touch sensors
/*var touchSensor = require('jsupm_mpr121');
var myTouchSensor = new touchSensor.MPR121(touchSensor.MPR121_I2C_BUS, touchSensor.MPR121_DEFAULT_I2C_ADDR);
myTouchSensor.configAN3944();
console.log(touchSensor.MPR121_I2C_BUS);
console.log(touchSensor.MPR121_DEFAULT_I2C_ADDR);*/


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
    //manual = 0;
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

/*process.on('exit', function () {
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
        msg.value = ledState;
        io.emit('toogle led', msg);
        ledState = !ledState; //invert the ledState
    });

});


http.listen(3000, function () {
    console.log('Web server Active listening on *:3000');
});
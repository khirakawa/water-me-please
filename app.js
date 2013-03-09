var events = require('events'),
  util   = require('util'),
  _  = require('underscore'),
  arduino = require('duino'),
  nconf = require('nconf'),
  twitter = require('ntwitter'),
  reading = false,
  self = this;

// read in configuration
// read in command line args
nconf.argv().env().file({ file: 'config.json' });

// our water level sensor
var WaterLevelSensor = function (options) {
  options = options || {};
  this.reading = false;
  this.debug = options.debug || false;
  this.pin = options.pin || 7;
  this.sensor_pin = options.sensor_pin || 'A0';
  this.baudrate = options.baudrate || 9600;

  var self = this;

  this.board = new arduino.Board({
    baudrate: this.baudrate,
    debug: this.debug
  });

  this.sensor = new arduino.Sensor({
    board: this.board,
    pin: this.sensor_pin,
    throttle: 100
  });

  this.board.on('ready', function () {
    // set pin to out mode
    self.board.pinMode(self.pin, 'out');

    // read from sensor
    self.sensor.on('read', function (err, value) {
      if (self.reading) {
        self.emit('measurementTaken', value);
      }
    });

    self.emit('ready');
  });
};

// make it emitterable
util.inherits(WaterLevelSensor, events.EventEmitter);

// add the enableSensor method
WaterLevelSensor.prototype.measure = function (ms) {
  console.log("enabling sensor");
  var self = this;
  this.reading = true;

  // send 5V to pin for 'ms' milliseconds
  this.board.digitalWrite(this.pin, this.board.HIGH);

  setTimeout(function () {
    self.board.digitalWrite(self.pin, self.board.LOW);
    self.reading = false;
  }, ms);
};

// set twitter
var TwitterUpdater = function (options) {
  options = options || {};
  var self = this;
  this.twit = new twitter({
    consumer_key: options.consumer_key,
    consumer_secret: options.consumer_secret,
    access_token_key: options.access_token_key,
    access_token_secret: options.access_token_secret
  }).verifyCredentials(function (err, data) {
    if (err) {
      console.log("could not verify twitter credentials. error:", err);
      process.exit(1);
    }

    self.emit("ready");
  });
};

// make it emitterable
util.inherits(TwitterUpdater, events.EventEmitter);

TwitterUpdater.prototype.updateStatus = function (msg) {
  this.twit.updateStatus(msg,
    function (err, data) {
      if (err) {
        console.log("failed update status. error:", err);
      }
    }
  );
};

var getMean = function (arr) {
  return _.reduce(arr, function (sum, item) {
    return sum + item;
  }, 0) / arr.length;
};

// first setup twitter
var twitterUpdater = new TwitterUpdater(nconf.get("twitter"));
twitterUpdater.on('ready', function () {
  // now setup the sensor
  var sensor = new WaterLevelSensor(nconf.get("arduino")),
    measurements = []; // running list of measurements.

  sensor.on('ready', function () {
    console.log("ready!");

    // take measurements at intervals
    var interval = nconf.get('measure_interval') || 10000;
    setInterval(function () {
      sensor.measure(2000);
    }, interval);
  });

  sensor.on('measurementTaken', function (value) {
    measurements.push(parseInt(value, 10));

    if (measurements.length === 5) {
      var mean = getMean(measurements);
      measurements.shift();

      if(mean > 500){
        // send tweet
      }
    }
  });
});
var events = require('events'),
  util = require('util'),
  _  = require('underscore'),
  arduino = require('duino');

// helper method to get mean of an array
var getMean = function (arr) {
  return _.reduce(arr, function (sum, item) {
    return sum + item;
  }, 0) / arr.length;
};

var getMedian = function (values) {

    values.sort( function(a,b) {return a - b;} );

    var half = Math.floor(values.length/2);

    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
};

// our water level sensor
var WaterLevelSensor = function (options) {
  options = options || {};
  this.debug = options.debug || false;
  this.pin = options.pin || 7;
  this.sensor_pin = options.sensor_pin || 'A0';
  this.baudrate = options.baudrate || 9600;

  // This will be used to determine when to tweet
  this.IM_DYING_THRESHOLD = 520;

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

    self.emit('ready');
  });
};

// make it emitterable
util.inherits(WaterLevelSensor, events.EventEmitter);

// measures for 5 reads and calls callback with average value
WaterLevelSensor.prototype.measure = function (callback) {
  var self = this,
    readCount = 0,
    measurements = []; // running list of measurements

  // send 5V to pin for 'ms' milliseconds
  this.board.digitalWrite(this.pin, this.board.HIGH);

  // read from sensor
  var readCallback = function (err, value) {
    measurements.push(parseInt(value, 10));

    if (measurements.length === 5) {
      var median = getMedian(measurements);
      console.log("mean", median);

      // reset mode
      self.board.digitalWrite(self.pin, self.board.LOW);
      self.sensor.removeListener('read', readCallback);

      // we're finished, evoke the callback
      callback(median);
    }
  };

  this.sensor.on('read', readCallback);
};

module.exports = WaterLevelSensor;
var events = require('events'),
  util   = require('util'),
  _  = require('underscore'),
  arduino = require('duino'),
  nconf = require('nconf'),
  twitter = require('ntwitter'),
  moment = require('moment'),
  reading = false,
  self = this;

// read in configuration
nconf.argv().env().file({ file: 'config.json' });

// helper method to get mean of an array
var getMean = function (arr) {
  return _.reduce(arr, function (sum, item) {
    return sum + item;
  }, 0) / arr.length;
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
      var mean = getMean(measurements);

      // reset mode
      self.board.digitalWrite(self.pin, self.board.LOW);
      self.sensor.removeListener('read', readCallback);

      // we're finished, evoke the callback
      callback(mean);
    }
  };

  this.sensor.on('read', readCallback);

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

TwitterUpdater.prototype.tweet = function (msg) {
  this.twit.updateStatus(msg,
    function (err, data) {
      if (err) {
        console.log("failed update status. error:", err);
      } else {
        console.log("tweeted:", msg);
      }
    }
  );
};

// first setup twitter
var twitterUpdater = new TwitterUpdater(nconf.get("twitter"));
twitterUpdater.on('ready', function () {

  // now setup the sensor
  var sensor = new WaterLevelSensor(nconf.get("arduino"));

  // on read state,
  sensor.on('ready', function () {

    var interval = nconf.get('measure_interval') || 10000,
      neglected = false;

    // take measurements at intervals
    setInterval(function () {
      sensor.measure(function (value) {

        // twitter will block duplicate tweets, so we'll need to add some
        // dates to make it unique.
        var date = moment().format('MMMM Do YYYY, h:mm:ss a');

        // If plant goes from neglected to rescued or vice versa, tweet!
        if (value > sensor.IM_DYING_THRESHOLD && !neglected) {
          twitterUpdater.tweet("Yo Dawg, I need water. Neglected from " + date);
          neglected = true;
        } else if (value <= sensor.IM_DYING_THRESHOLD && neglected) {
          twitterUpdater.tweet("Ah, that feels good.  Thanks for the water.  Rescued on " + date);
          neglected = false;
        }
      });
    }, interval);
  });
});
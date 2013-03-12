var http = require('http'),
  nconf = require('nconf'),
  moment = require('moment'),
  WaterLevelSensor = require('./lib/sensor.js'),
  TwitterUpdater = require('./lib/twitter.js'),
  GeckoboardPusher = require('./lib/geckoboard.js');

// read in configuration
nconf.argv().env().file({ file: 'config.json' });

// first setup twitter
var twitterUpdater = new TwitterUpdater(nconf.get("twitter"));
twitterUpdater.on('ready', function () {

  // now setup the sensor and instantiate geckboard pusher
  var sensor = new WaterLevelSensor(nconf.get("arduino")),
    geckboard = new GeckoboardPusher(nconf.get("geckoboard"));

  // on ready state,
  sensor.on('ready', function () {

    var interval = nconf.get('measure_interval') || 10000,
      neglected = false;

    // just a utility method to send to both twitter and geckobaord
    var sendMessage = function(msg){
      twitterUpdater.tweet(msg);
      geckboard.pushText(msg);
    };

    // take measurements at intervals
    setInterval(function () {
      sensor.measure(function (value) {

        // twitter will block duplicate tweets, so we'll need to add some
        // dates to make it unique.
        var date = moment().format('MMMM Do YYYY, h:mm:ss a');

        // If plant goes from neglected to rescued or vice versa, tweet!
        if (value > sensor.IM_DYING_THRESHOLD && !neglected) {
          sendMessage("Yo Dawg, I need water. Neglected from " + date);
          neglected = true;
        } else if (value <= sensor.IM_DYING_THRESHOLD && neglected) {
          sendMessage("Ah, that feels good.  Thanks for the water.  Rescued on " + date);
          neglected = false;
        }
      });
    }, interval);
  });


});
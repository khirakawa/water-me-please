var http = require('http'),
  fs = require('fs'),
  nconf = require('nconf'),
  moment = require('moment'),
  WaterLevelSensor = require('../lib/sensor.js'),
  TwitterUpdater = require('../lib/twitter.js'),
  GeckoboardPusher = require('../lib/geckoboard.js');


// Read in config file and verify that it exists.
var configFilePath = __dirname + '/' + process.argv[2];
if (!fs.existsSync(configFilePath)) {
  console.log("failed to find configFile at ", process.argv[2]);
  console.log("make sure you pass it in as first argument: node app.js [relative_path_to_config_file]");
  process.exit(1);
}

// read in configuration
nconf.argv().env().file({ file: configFilePath });

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
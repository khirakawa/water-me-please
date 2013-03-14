var events = require('events'),
  util   = require('util'),
  twitter = require('ntwitter');

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

module.exports = TwitterUpdater;
var http = require('http');

var Geckoboard = function(options){
  // Now post to geckoboard once finished
  this.widgetKey = options.widget_key;
  this.apiKey = options.api_key;

  this.postOptions = {
    host: "push.geckoboard.com",
    method : 'POST',
    path : "/v1/send/" + this.widgetKey
  };
};

Geckoboard.prototype.pushText = function(text){

  var data = {
    "item":[{
      "text": text,
      "type":0
    }]
  };

  // Stringify post data
  var postData = JSON.stringify({api_key : this.apiKey, data: data});

  // Create the post object
  // http://stackoverflow.com/questions/6158933/http-post-request-in-node-js
  var postReq = http.request(this.postOptions, function(res){
    var data = "";
    res.on('data', function(chunk){
      data += chunk;
    });

    res.on('end', function(){
      data = JSON.parse(data);
      console.log("finished", data);
      if(!data.success){
        console.log("geckoboard returned with error");
      }
    });
  });

  postReq.on('error', function(e){
    console.log("oops, there was an error pushing to geckoboard", e);
  });

  // Post to geckoboard and pray it works.
  postReq.write(postData);
  postReq.end();
};

module.exports = Geckoboard;

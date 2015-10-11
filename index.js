#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var parseUrl = require('url').parse;

var clientSecretFilename = process.argv[2];

// TODO: make these configurable
var SCOPES = [
  'https://spreadsheets.google.com/feeds',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

var google = {
  auth: {
    OAuth2: require('google-auth-library/lib/auth/oauth2client')
  }
};

if (!clientSecretFilename || !fs.existsSync(clientSecretFilename)) {
  console.log('goto https://console.developers.google.com/project and download a ' +
              'client_secret json file for your project and pass the path to it ' + 
              'as the first argument');
  process.exit(0);
}

var CREDENTIALS = JSON.parse(fs.readFileSync(clientSecretFilename, 'utf8'));

var CLIENT_ID = CREDENTIALS.web.client_id;
var CLIENT_SECRET = CREDENTIALS.web.client_secret;
var REDIRECT_URL = CREDENTIALS.web.redirect_uris.filter(function(uri){
  return /localhost:[0-9]+/.test(uri);
})[0];

if (!REDIRECT_URL) {
  console.log('could not find a localhost redirect url', CREDENTIALS.web.redirect_uris, 
              'please go to https://console.developers.google.com/project and add one. Any ' +
              'port will do, e.g. http://localhost:5000');
  process.exit(1);
}

var oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

var url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  approval_prompt: 'force'
});

var port = parseInt(/:([0-9]+)\/?$/.exec(REDIRECT_URL)[1], 10);

startServer(port);

function startServer(port) {

  function send(res, message) {
    res.writeHead(200);
    res.end(message.toString());
  }
  
  function sendError(res, err) {
    res.writeHead(500);
    res.end(err.toString());
  }

  var server = http.createServer(function(req, res){
    var u = parseUrl(req.url, true);

    var code = u.query.code;

    if (!code) {
      sendError(res, 'did not find code in server request');
      return;
    }

    oauth2Client.getToken(code, function(err, tokens) {
      if (err) return sendError(res, err);
      send(res, JSON.stringify(tokens, null, 2));
    });

  })

  server.listen(port, function(){
    console.log('listening on', port);
    console.log('please visit\n\n  ', url);
  });

}
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var config = require('./config/config.' + process.env.NODE_ENV).serverConfig;
var app = express();

if (config.maintenanceMode) {
  app.get('/', function (req, res) {
    res.sendfile('maintenance.html', { root: __dirname + "/public" });
  });
}

if (config.behindHttps) {
  app.use(function (req, res, next) {
    if ((!req.secure) && (req.get('X-Forwarded-Proto') !== 'https')) {
      res.redirect('https://' + req.get('Host') + req.url);
    }
    else
      next();
  });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

var compression = require('compression'); //comment these 2 lines in case you use nginx or other reverse proxy
app.use(compression());

app.use(express.static(path.join(__dirname, 'public')));

var httpRequestLogger = require('./logging/httpRequestLogger');
app.use(httpRequestLogger);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(app.router);
var master = require('./routes/masterData');
var message = require('./routes/messages');
app.use('/masterData', master);
app.use('/message', message);
var appLogger = require('./logging/appLogger');


var auth = require('./routes/auth');
var branding = require('./routes/branding');
var remote = require('./routes/remote');
var fieldConfiguration = require('./routes/fieldConfiguration');




app.use('/fieldConfiguration', fieldConfiguration);
app.use('/auth', auth);
app.use('/branding', branding);
app.use('/remote', remote);






// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
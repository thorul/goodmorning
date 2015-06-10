var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Morning Checks - Cronacle' });
});

/* GET curves page. */
router.get('/curves', function(req, res, next) {
    res.render('curves', { title: 'Curve templates' });
});

/* GET batch stats page. */
router.get('/bstats', function(req, res, next) {
    res.render('bstats', { title: 'Batch Stats' });
});

module.exports = router;

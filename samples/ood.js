/*
 *  ood.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-11
 *
 *  Demonstrate out-of-date checking
 *  Make sure to see README first
 */

var _ = require('iotdb')._;
var Transport = require('../RedisTransport').RedisTransport;

var transport = new Transport({
    check_timestamp: true,
});

var value = {
    first: "David",
    last: "Janes",
};
value = _.timestamp.add(value);

var _update = function() {
    transport.update({
        id: "MyThingID", 
        band: "meta", 
        value: value,
    }, function(d) {
        console.log("+ _update(callback)", "\n ", d);
    });
};

setInterval(_update, 5 * 1000);
_update();

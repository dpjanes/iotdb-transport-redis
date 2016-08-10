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
    transport.put({
        id: "MyThingID", 
        band: "meta", 
        value: value,
    }, function(error, ud) {
        if (error) {
            console.log("#", _.error.message(error), _.error.code(error));
            return;
        }
        console.log("+ _update/put(callback)", ud);
    });
};

setInterval(_update, 5 * 1000);
_update();

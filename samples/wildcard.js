/*
 *  wildcard.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Demonstrate receiving everything
 *  Make sure to see README first
 */

var Transport = require('../RedisTransport').RedisTransport;

var transport = new Transport({
    verbose: true,
});
transport.updated({}, function(ud) {
    if (ud.value === undefined) {
        transport.get(ud, function(error, gd) {
            if (error) {
                console.log("#", error);
                return;
            }
            console.log("+", gd.id, gd.band, gd.value);
        });
    } else {
        console.log("+", ud.id, ud.band, ud.value);
    }
});

/*
 *  receive.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var Transport = require('../RedisTransport').RedisTransport;

var transport = new Transport({
});
transport.get({
    id: "MyThingID", 
    band: "meta", 
}, function(gd) {
    console.log("+", "get(callback)", "\n ", gd.id, gd.band, gd.value);
});
transport.updated({
    id: "MyThingID", 
    band: "meta", 
}, function(ud) {
    if (ud.value === undefined) {
        transport.get(ud, function(gd) {
            console.log("+", "updated(callback)/get(callback)", "\n ", gd.id, gd.band, gd.value);
        });
    } else {
        console.log("+", "updated(callback)", "\n ", ud.id, ud.band, ud.value);
    }
});


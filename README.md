# iotdb-transport-redis
[IOTDB](https://github.com/dpjanes/node-iotdb) 
[Transporter](https://github.com/dpjanes/node-iotdb/blob/master/docs/transporters.md)
for
[Redis](http://redis.io/)

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

# About

This Transporter writes data to [Redis](http://redis.io/) in JSON with keys named like paths.
_Currently does not have notification ability, we may add this in the near future._

* [Read more about Transporters](https://github.com/dpjanes/node-iotdb/blob/master/docs/transporters.md)

# Use

See the samples folder for working examples

## Basic

Don't forget your `subscribe`s! Most Transporter methods 
return RX Observables.


    const redis_transport = require("iotdb-transport-redis");

We provide a helper to create a Redis client

    const redis_client = redis_transport.connect({
        "host": "redis.example.com",
        "password": "abcdef0123",
        "db": 2
    }, (error, redis_client) => {
        if (error) {
            return console.log("#", _.error.message(error));
        }
    })

    const redis_transporter = redis_transport.make({
        prefix: "/root",
    }, redis_client);

    redis_transport.put({
        id: "light",
        band: "ostate",
        value: { on: true }
    }).subscribe()

## Broadcasting

Here's how you send all data / updates to Redis

    const iotdb = require("iotdb");
    iotdb.use("homestar-wemo");
    
    const things = iotdb.connect("WeMoSocket");

    const iotdb_transport = require("iotdb-transport-iotdb");
    const iotdb_transporter = iotdb_transport.make({}, things);

Create the Redis Transporter as per above.
Then tell the Redis Transporter to get all the data from the IOTDB Transporter.

    redis_transporter.use(iotdb_transporter)



process.on("beforeExit", (code) => {
    console.log("Process beforeExit event with code: ", code);
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].stop()
    }
});


process.on("exit", (code) => {
    console.log("Process exit event with code: ", code);
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].stop()
    }
});

process.on("SIGTERM", (signal) => {
    console.log(`Process ${process.pid} received a SIGTERM signal`);
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].stop()
    }
    process.exit(0);
});

process.on("SIGINT", (signal) => {
    console.log(`Process ${process.pid} has been interrupted`);
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].stop()
    }
    process.exit(0);
});

process.on("uncaughtException", (err) => {
    console.log(`Uncaught Exception: ${err.message}`);
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].stop()
    }
    process.exit(1);
});




const cipclient = require('./crestroncip.js');
const config = require("./configuration.json");
const OutputNodes = config.ArtnetConfig.ArtnetOutputNodes
const CrestronIpId = String.fromCharCode(parseInt(config.CrestronConfig.IPID, 16));

var dmxlib = require('dmxnet');
var dmxnet = new dmxlib.dmxnet({
    log: { level: 'info' }, // Winston logger options
    oem: 0, // OEM Code from artisticlicense, default to dmxnet OEM.
    esta: 0, // ESTA Manufacturer ID from https://tsp.esta.org, default to ESTA/PLASA (0x0000)
    sName: "CrestronArtNet", // 17 char long node description, default to "dmxnet"
    lName: "CrestronArtNet - TH", // 63 char long node description, default to "dmxnet - OpenSource ArtNet Transceiver"
    hosts: config.ArtnetConfig.ListenToInterfaces, // Interfaces to listen to, all by default
    errFunc: function (err) {
        this.error(`Error: ${err.message}, stack: ${err.stack}`);
    }.bind(this) // optional function to handle errors from the library by yourself. If omitted the errors will be thrown by the library
});

// Connect to Crestron



var ArtnetSenders = {}
var RecievedArtnetCache = {}

var Bypassed = {}

var SentCache = {
    Digital: {},
    Analog: {},
    Serial: {}
}

var RecievedCache = {
    Digital: {},
    Analog: {},
    Serial: {}
}

const cip = cipclient.connect({ host: config.CrestronConfig.Host, ipid: CrestronIpId })

function SetDigital(Join, Value) { // Setting digital values + debug output
    // if (SentCache.Digital[Join] === Value) return
    SentCache.Digital[Join] = Value
    if (config.CrestronDebug) { console.log(`Setting digital join ${String(Join)} to: ${String(Value)}`) }
    cip.dset(Join, Value)
}

function SetAnalog(Join, Value) { // Setting analog values + debug output
    if (SentCache.Analog[Join] === Value) return
    SentCache.Analog[Join] = Value
    if (config.CrestronDebug) { console.log(`Setting analog join ${String(Join)} to: ${String(Value)}`) }
    cip.aset(Join, Value)
}

function SetSerial(Join, Value) { // Setting analog values + debug output
    //if (SentCache.Serial[Join] === Value) return
    SentCache.Serial[Join] = Value
    if (config.CrestronDebug) { console.log(`Setting serial join ${String(Join)} to: ${String(Value)}`) }
    cip.sset(Join, String(Value))
}

function SetDmx(Channel, Value) {
    if (config.ArtnetOutputDebug) { console.log(`Setting channel ${String(Number(Channel) + 1)} to: ${String(Value)}`) }
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].setChannel(Channel, Value)
    }
}

function PrepDMX(Channel, Value) {
    if (config.ArtnetOutputDebug) { console.log(`Preparing channel ${String(Number(Channel) + 1)} to: ${String(Value)}`) }
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].prepChannel(Channel, Value)
    }
}

function Transmit() {
    if (config.ArtnetOutputDebug) { console.log(`Transmitting prepared channels`) }
    for (var SenderName in ArtnetSenders) {
        ArtnetSenders[SenderName].transmit()
    }
}

if (config.ArtnetConfig.ArtnetInput.Enabled === true) {
    var receiver = dmxnet.newReceiver(config.ArtnetConfig.ArtnetInput);
    receiver.on('data', async function (data) {
        if (config.ArtnetInputDebug) { console.log(`New DMX Input Signal: `, data) }
        RecievedArtnetCache = data
        for (var i in data) {
            SetAnalog(Number(i) + 1, data[i])
            if (!Bypassed[Number(i) + 1]) PrepDMX(i, data[i])
            if (Number(i) + 1 === config.ArtnetConfig.ArtnetInput.LastAddress) break
        }
        Transmit()
    });
}

for (var NodeName in OutputNodes) {
    var Node = OutputNodes[NodeName]
    if (Node.Enabled === true) {
        ArtnetSenders[NodeName] = dmxnet.newSender({
            ip: Node.IP,
            subnet: Node.Subnet,
            universe: Node.Universe,
            net: Node.Net,
            port: Node.Port,
            base_refresh_interval: Node.BaseRefreshInterval
        })
    }
}


cip.subscribe((data) => { // Incoming data from Crestron
    if (config.CrestronDebug) { console.log("Recieved Join From Crestron:", data) }
    if (data.type === "analog") {
        RecievedCache.Analog[data.join] = data.value
        if (data.join >= 1 && data.join <= 255 && Bypassed[data.join]) {
            SetDmx(Number(data.join) - 1, data.value)
        }
    }
    if (data.type === "digital") {
        RecievedCache.Digital[data.join] = data.value
        if (data.value === 0) Bypassed[data.join] = false
        if (data.value === 1) {
            Bypassed[data.join] = true
            if (RecievedCache.Analog[data.join] !== null) SetDmx(Number(data.join) - 1, RecievedCache.Analog[data.join])
        }
    }
})


cip.status((status) => { // Incoming data from Crestron
    if (status === "registered") {
        console.log(`Crestron | Registered to ${config.CrestronConfig.Host}`)
        for (var i in RecievedArtnetCache) {
            SetAnalog(Number(i) + 1, RecievedArtnetCache[i])
            if (Number(i) + 1 === config.ArtnetConfig.ArtnetInput.LastAddress) break
        }
    }
    if (status === "register request") {
        console.log(`Crestron | Attempting to register to ${config.CrestronConfig.Host}`)
    }
    if (status === "register failed") {
        console.log(`Crestron | Failed to register to ${config.CrestronConfig.Host}`)
    }
    if (status === "disconnected") {
        console.log(`Crestron | Disconnected from ${config.CrestronConfig.Host}`)
    }
    if (status === "socket error") {
        console.log(`Crestron | Socket Error`)
    }
})

# crestron-artnet
Allows crestron to send and receive artnet, with bypass modes

By default, this program will just receive art net from one source, and send it to another, and also sends the information into SIMPL as analog joins.
This program emulates a touch panel in the SIMPL program, in order to send and receive joins to the SIMPL program.

Analog join 1 represents DMX address 1, and is 1:1 all the way from address/join 1-512, each address can have a value between 0 and 255.

In order to tell the program you want to send address values from SIMPL to ArtNet, the digital join number corresponding with the address must be 1 (high), which activates the bypass mode, so that address will ignore its ArtNet input, and will instead output the analog join sent from SIMPL, into ArtNet. Please note that whilst bypassed, the incoming (feedback) analog join for that address, will still be what the program is receiving from the ArtNet input, which can allow for smoother transitions if you want to actively switch between ArtNet input, and control with SIMPL.

Example use case:
By default a lighting console sends ArtNet into the input, and the program just acts as a repeater to the configured output, i.e for normal show operation with a lighting console.
The moment a lighting console is not present, the SIMPL program can "act" as the console, bypassing certain addresses to control fixtures, for example house lights, workers, etc.
This program can also be used to make presets with SIMPL, maybe for small scale events that do not require a lighting console, but still need some light on stage, or different colours and looks.

# Configuration

Configuration is quite self explanatory, only one input is supported at the moment, but you can have as many outputs as you want.

# Known Bugs

This program has not been tested since updating `crestroncip.js` to support 16 bit values, so there is a good chance only addresses 1-255 will function.

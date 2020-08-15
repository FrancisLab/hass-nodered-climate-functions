// name: Mode Params
// outputs: 1
// initialize: // Code added here will be run once\n// whenever the node is deployed.\n
// finalize: // Code added here will be run when the\n// node is being stopped or re-deployed.\n
// info: 
if (!msg.payload.set_mode_params) {
    return null;
}

msg.payload.data = msg.payload.set_mode_params;
return msg;
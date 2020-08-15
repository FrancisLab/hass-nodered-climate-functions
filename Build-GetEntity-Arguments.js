// name: Get Entity Rules
// outputs: 1
// initialize: // Code added here will be run once\n// whenever the node is deployed.\n
// finalize: // Code added here will be run when the\n// node is being stopped or re-deployed.\n
// info: 
var climate_entities = "^climate.*";
var climate_bools = "^input_boolean.*climate.*";
var others = "input_boolean.house_occupied|input_boolean.vacation_mode_enabled|sensor.weather_temperature";


var regex = "(" + climate_entities + "|" + climate_bools + "|" + others + ")";
var payload = {
    rules: [
        {
            property : "entity_id",
            logic : "is",
            value : regex,
            valueType : "re", // Regex
        }]
};


msg.payload = payload;
return msg;
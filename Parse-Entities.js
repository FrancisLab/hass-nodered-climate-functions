// name: To Dict
// outputs: 1
// initialize: // Code added here will be run once\n// whenever the node is deployed.\n
// finalize: // Code added here will be run when the\n// node is being stopped or re-deployed.\n
// info: 
// Parse raw entities into a more usable object

var parsed = {};
msg.payload.forEach(
    entity => 
        parsed[entity.entity_id] = entity);
        
function parseClimateData(entities, room_id) {
    
    var climate_entity_id = "climate." + room_id;
    var climate_entity = entities[climate_entity_id];
    
    var global_override_id = "input_boolean.climate_" + room_id + "_override";
    var global_override = entities[global_override_id] !== undefined && 
        entities[global_override_id].state === "on";
    
    var day_override_id = "input_boolean.climate_" + room_id + "_day_override"
    var day_override = entities[day_override_id] !== undefined && 
        entities[day_override_id].state === "on";
    
    return {
        currentMode :
            climate_entity.state,
        currentTarget : 
            climate_entity.attributes.temperature,
        currentMaxTarget : 
            climate_entity.attributes.target_temp_high,
        currentMinTarget : 
            climate_entity.attributes.target_temp_low,
        currentTemp : 
            climate_entity.attributes.current_temperature,
        isRoomOverrideOn: global_override,
        isDayOverrideOn: day_override,
    };
}

var now = new Date();

var climate_variables = {
    time : now,
    outdoorTemperature : 
        parseFloat(parsed["sensor.weather_temperature"].state),
    isHome : 
        parsed["input_boolean.house_occupied"].state === "on",
    isVacationMode : 
        parsed["input_boolean.vacation_mode_enabled"].state === "on",
    isOverrideOn :
        parsed["input_boolean.climate_manual_override"].state === "on",
    isTempOverrideOn :
        parsed["input_boolean.climate_temp_override"].state === "on",
    isHeatOverrideOn :
        parsed["input_boolean.climate_heat_override"].state === "on",
    isCoolOverrideOn :
        parsed["input_boolean.climate_cool_override"].state === "on",
    isOutdoorCoolerOverrideOn :
        parsed["input_boolean.climate_outdoor_cooler_override"].state === "on",
    isOutdoorWarmerOverrideOn :
        parsed["input_boolean.climate_outdoor_warmer_override"].state === "on",
    livingRoom : parseClimateData(parsed, "living_room"),
    guestBedroom : parseClimateData(parsed, "guest"),
    masterBedroom : parseClimateData(parsed, "bedroom"),
};

msg.payload = climate_variables;
return msg;
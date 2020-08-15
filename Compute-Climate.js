// name: Compute Climate
// outputs: 1
// initialize: // Code added here will be run once\n// whenever the node is deployed.\n
// finalize: // Code added here will be run when the\n// node is being stopped or re-deployed.\n
// info: 
var input = msg.payload;

const contexts = {
    DAY: 'Day',
    NIGHT: 'Night',
    AWAY: 'Away',
    VACATION: 'Vacation'
}

const modes = {
    OFF: "off",
    HEAT: "heat",
    COOL: "cool"
}

const notifyReasons = {
    COOLER: "cooler",
    WARMER: "warmer"
}

const contextsToNotifyAboutOutdoorTemp = [contexts.DAY, contexts.AWAY, contexts.NIGHT];

var masterBedroomConfig = {
    name : "Bedroom",
    global_input_key : "masterBedroom",
    climate_entity: "climate.bedroom",
    reason_entity: "input_text.bedroom_climate_reason",
    // Temperature buffer when heating/cooling
    buffer: 0.5,
    // When night time starts/ends
    night_time_start_hour: 21,
    night_time_end_hour: 8,
    // Daytime + Present
    day_time_max: 22,
    day_time_min: 20,
    // Night time + Present: Allow cooler, but not warmer
    night_time_max: 21.5,
    night_time_min: 19.5,
    // Away: Allow slightly cooler/warmer
    away_max: 27,
    away_min: 18,
    // Vacation: Safe minimum only
    vacation_min: 15,
};

var livingRoomConfig = {
    name : "Living Room",
    global_input_key : "livingRoom",
    climate_entity: "climate.living_room",
    reason_entity: "input_text.living_climate_reason",
    // Temperature buffer when heating/cooling
    buffer: 0.5,
    // When night time starts/ends
    night_time_start_hour: 22,
    night_time_end_hour: 8,
    // Daytime + Present
    day_time_max: 23,
    day_time_min: 20,
    // Night time + Present: Allow cooler, but not warmer
    night_time_max: 25,
    night_time_min: 16,
    // Away: Allow slightly cooler/warmer
    away_max: 27,
    away_min: 18,
    // Vacation: Safe minimum only
    vacation_min: 15,
};

var guestBedroomConfig = {
    name : "Guest Bedroom",
    global_input_key : "guestBedroom",
    climate_entity: "climate.guest",
    reason_entity: "input_text.guest_climate_reason",
    // Temperature buffer when heating/cooling
    buffer: 0.5,
    // When night time starts/ends
    night_time_start_hour: 20,
    night_time_end_hour: 8,
    // Daytime + Present
    day_time_max: 23,
    day_time_min: 18,
    // Night time + Present: Allow cooler, but not warmer
    night_time_max: 25,
    night_time_min: 16,
    // Away: Allow slightly cooler/warmer
    away_max: 27,
    away_min: 16,
    // Vacation: Safe minimum only
    vacation_min: 15,
};

var roomConfigs = [masterBedroomConfig, livingRoomConfig, guestBedroomConfig];

function buildOutputs(room_config, reason, mode = null, target_temp = null, notify_args = null) {
    var set_mode_parameters = null;
    if (mode !== null) {
        set_mode_parameters = {
            "entity_id" : room_config.climate_entity,
            "hvac_mode": mode
        };
    }

    var set_temp_parameters = null;
    if (mode === "heat_cool") {
        set_temp_parameters = {
            "entity_id" : room_config.climate_entity,
            "target_temp_high": max_warm,
            "target_temp_low": max_cold,
        };
    } else if (mode === "heat" || mode === "cool") {
        set_temp_parameters = {
            "entity_id" : room_config.climate_entity,
            "temperature": target_temp
        };
    }

    var set_reason_parameters = {
        "entity_id" : room_config.reason_entity,
        "value": reason,
    }

    return {
        payload: {
            set_mode_params: set_mode_parameters,
            set_temp_params: set_temp_parameters,
            set_reason_params: set_reason_parameters,
            notify_params: notify_args,
        }
    }
}

function shouldHeat(climate_data, minTemp, buffer) {
    if (minTemp === null) {
        return false;
    }

    var currentTemp = climate_data.currentTemp;
    var currentMode = climate_data.currentMode;

    var isBellowMin = currentTemp < minTemp;

    // If we are already heating and bellow our buffered min, keep heating
    var bufferedMin = minTemp + buffer;
    var isHeatingToBuffer = (currentMode === modes.HEAT) &&
        (currentTemp < bufferedMin);

    return isBellowMin || isHeatingToBuffer;
}

function shouldCool(climate_data, maxTemp, buffer) {
    if (maxTemp === null) {
        return false;
    }

    var currentTemp = climate_data.currentTemp;
    var currentMode = climate_data.currentMode;

    var isAboveMax = currentTemp > maxTemp;

    // If we are already cooling and above our buffered max, keep cooling
    var bufferedMax = maxTemp - buffer;
    var isCoolingToBuffer = (currentMode === modes.COOL) &&
        (currentTemp > bufferedMax);

    return isAboveMax || isCoolingToBuffer;
}

function buildNotifyArguments(reason) {
    var notify_args = null;
    switch (reason) {
        case notifyReasons.COOLER:
            notify_args = {
                "title": "Climate Alert",
                "message": "AC is running while it's cooler outside. Would you like to open a couple windows instead?",
                "data" : {
                    "push" : {
                        "category" : "OUTDOOR_COOLER_ALARM"
                    },
                    "apns_headers" : {
                        "apns-collapse-id": "climate-alert"
                    }
                }
            };
            break;
        case notifyReasons.WARMER:
            notify_args = {
                "title": "Climate Alert",
                "message": "Heating is running while it's warmer outside. Would you like to open a couple windows instead?",
                "data" : {
                    "push" : {
                        "category" : "OUTDOOR_WARMER_ALARM"
                    },
                    "apns_headers" : {
                        "apns-collapse-id": "climate-alert"
                    }    
                }
            };
            break;
    }

    return notify_args;
}

function computeClimateForContext(input, room_config, room_data, context, max_temp, min_temp, heatCoolBuffer) {
    var reason = context + ": ";
    // Should we cool?
    if (shouldCool(room_data, max_temp, heatCoolBuffer)) {
        // Is cooling disabled?
        if (input.isCoolOverrideOn) {
            reason += "Cooling Override";
            return buildOutputs(room_config, reason, modes.OFF);
        }
        
        // Can this context's climate be overriden by outdoor temperature?
        var notify_cooler_args = null;
        if (contextsToNotifyAboutOutdoorTemp.includes(context)) {
            // Is override already set?
            if (input.isOutdoorCoolerOverrideOn) {
                var coolerOutdoorReason = reason += "Cooler Outdoor Override";
                return buildOutputs(room_config, coolerOutdoorReason, modes.OFF);
            }
            
            // Is the weather outside cooler? Should we notify?
            if (input.outdoorTemperature < max_temp) {
                notify_cooler_args = buildNotifyArguments(notifyReasons.COOLER);
            }
        }

        reason += "Temp > " + max_temp.toString();
        target_cool_temp = max_temp - heatCoolBuffer;
        return buildOutputs(room_config, reason, modes.COOL, target_cool_temp, notify_cooler_args);
    }
    // Should we heat?
    else if (shouldHeat(room_data, min_temp, heatCoolBuffer)) {
        // Is heating disabled?
        if (input.isHeatOverrideOn) {
            reason += "Heating Override";
            return buildOutputs(room_config, reason, modes.OFF);
        }

        // Can this context's climate be overriden by outdoor temperature?
        var notify_warmer_args = null;
        if (contextsToNotifyAboutOutdoorTemp.includes(context)) {
            // Is override already set?
            if (input.isOutdoorWarmerOverrideOn) {
                var warmerOutdoorReason = reason += "Warmer Outdoor Override";
                return buildOutputs(room_config, warmerOutdoorReason, modes.OFF);
            }
            
            // Is the weather outside warmer? Should we notify?
            if (input.outdoorTemperature > min_temp) {
                notify_warmer_args = buildNotifyArguments(notifyReasons.WARMER);
            }
            
            // TODO: Else, if the override is set, notify again to remove it?
        }

        reason += "Temp < " + min_temp.toString();
        target_heat_temp = min_temp + heatCoolBuffer;
        return buildOutputs(room_config, reason, modes.HEAT, target_heat_temp, notify_warmer_args);
    }
    // Nothing to do, turn off
    else {
        min_string = min_temp !== null ? min_temp.toString() : "N/A";
        max_string = max_temp !== null ? max_temp.toString() : "N/A";
        reason += min_string + " < Temp < " + max_string;
        return buildOutputs(room_config, reason, modes.OFF);
    }
}

function computeClimate(input, room_data, room_config) {
    var heatCoolBuffer = room_config.buffer;

    // Vacation mode
    if (input.isVacationMode) {
        return computeClimateForContext(input, room_config, room_data, contexts.VACATION, null, room_config.vacation_min, heatCoolBuffer);
    }

    // Away mode
    if (!input.isHome) {
        return computeClimateForContext(input, room_config, room_data, contexts.AWAY, room_config.away_max, room_config.away_min, heatCoolBuffer);
    }

    // Night Mode
    if (input.time.getHours() >= room_config.night_time_start_hour ||
        input.time.getHours() < room_config.night_time_end_hour) {

        return computeClimateForContext(input, room_config, room_data, contexts.NIGHT, room_config.night_time_max, room_config.night_time_min, heatCoolBuffer);
    }

    // Day Mode
    if (room_data.isDayOverrideOn) {
        return buildOutputs(room_config, "Day Override", modes.OFF);
    } else {
        return computeClimateForContext(input, room_config, room_data, contexts.DAY, room_config.day_time_max, room_config.day_time_min, heatCoolBuffer);
    }
    
    // Unexpected
    return buildOutputs(room_config, "Unexpected context");
}

function updateRoomClimate(global_input, room_config) {
    var msg = null;
    var room_input_data = global_input[room_config.global_input_key];
    
    if (global_input.isOverrideOn) {
        msg =  buildOutputs(room_config, "Manual Global Override");
    }
    else if (global_input.isTempOverrideOn) {
        msg =  buildOutputs(room_config, "Temporary Global Override");
    }
    else if (room_input_data.isRoomOverrideOn) {
        reason = room_config.name + " Override";
        msg = buildOutputs(room_config, reason);
    } else {
        msg = computeClimate(global_input, room_input_data, room_config);
    }

    node.send(msg);
}

roomConfigs.forEach(function(room_config) {
    updateRoomClimate(input, room_config);
});
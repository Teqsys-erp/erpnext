frappe.provide("erpnext.timesheet");

let interval; // Global interval variable to keep the timer running
let saveInterval; // Global interval for saving live_timer

erpnext.timesheet.timer = function (frm, row, timestamp = 0) {
    let dialog = new frappe.ui.Dialog({
        title: __("Timer"),
        fields: [
            {
                fieldtype: "Link",
                label: __("Activity Type"),
                fieldname: "activity_type",
                reqd: 1,
                options: "Activity Type",
            },
            { fieldtype: "Section Break"},
            { fieldtype: "Int", label: __("Count"), fieldname: "custom_count" },
            {
                fieldtype: "Link",
                label: __("Task Element"),
                fieldname: "custom_task_element",
                options: "Task Element",
            },
            { fieldtype: "Float", label: __("Expected Hrs"), fieldname: "expected_hours" },
            { fieldtype: "Section Break" },
            { fieldtype: "HTML", fieldname: "timer_html" },
        ],
    });

    if (row) {
        dialog.set_values({
            activity_type: row.activity_type,
            custom_count: row.custom_count,
            custom_task_element: row.custom_task_element,
            expected_hours: row.expected_hours,
        });
    }

    dialog.get_field("timer_html").$wrapper.append(get_timer_html());

    function get_timer_html() {
        return `
            <div class="stopwatch">
                <span class="hours">00</span>
                <span class="colon">:</span>
                <span class="minutes">00</span>
                <span class="colon">:</span>
                <span class="seconds">00</span>
            </div>
            <div class="playpause text-center">
                <button class="btn btn-primary btn-start"> ${__("Start")} </button>
                <button class="btn btn-success btn-complete"> ${__("Complete")} </button>
            </div>
        `;
    }

    erpnext.timesheet.control_timer(frm, dialog, row, timestamp);
    dialog.show();

    dialog.on_close = function () {
        // Optionally save the current timer value when dialog is closed
        var grid_row = frm.fields_dict["time_logs"].grid.get_row(row.idx - 1);
        grid_row.doc.live_timer = formatTime(currentIncrement);
        grid_row.refresh();
        frm.dirty();
        frm.save();
    };
};

erpnext.timesheet.control_timer = function (frm, dialog, row, timestamp = 0) {
    var $btn_start = dialog.$wrapper.find(".playpause .btn-start");
    var $btn_complete = dialog.$wrapper.find(".playpause .btn-complete");
    var currentIncrement = timestamp;
    var initialized = row ? true : false;
    var flag = true;

    if (row) {
        initialized = true;
        $btn_start.hide();
        $btn_complete.show();
        initializeTimer();
    }

    if (!initialized) {
        $btn_complete.hide();
    }

    $btn_start.click(function (e) {
        if (!initialized) {
            var args = dialog.get_values();
            if (!args) return;
            if (
                frm.doc.time_logs.length == 1 &&
                !frm.doc.time_logs[0].activity_type &&
                !frm.doc.time_logs[0].from_time
            ) {
                frm.doc.time_logs = [];
            }
            row = frappe.model.add_child(frm.doc, "Timesheet Detail", "time_logs");
            row.activity_type = args.activity_type;
            row.custom_count = args.custom_count;
            row.custom_task_element = args.custom_task_element;
            row.from_time = frappe.datetime.get_datetime_as_string();
            row.expected_hours = args.expected_hours;
            row.completed = 0;
			row.custom_timer_state = "Running"; 
            let d = moment(row.from_time);
            if (row.expected_hours) {
                d.add(row.expected_hours, "hours");
                row.to_time = d.format(frappe.defaultDatetimeFormat);
            }
            frm.refresh_field("time_logs");
            frm.save();
        }

        if (!initialized) {
            initialized = true;
            $btn_start.hide();
            $btn_complete.show();
            initializeTimer();
        }
    });

    $btn_complete.click(function () {
        clearInterval(interval);
        clearInterval(saveInterval); // Clear the save interval as well

        var grid_row = frm.fields_dict["time_logs"].grid.get_row(row.idx - 1);
        var args = dialog.get_values();
        grid_row.doc.completed = 1;
        grid_row.doc.activity_type = args.activity_type;
        grid_row.doc.custom_count = args.custom_count;
        grid_row.doc.custom_task_element = args.custom_task_element;
        grid_row.doc.expected_hours = args.expected_hours;
        grid_row.doc.hours = currentIncrement / 3600;
        grid_row.doc.to_time = frappe.datetime.now_datetime();
        grid_row.doc.live_timer = formatTime(currentIncrement);
		grid_row.doc.custom_timer_state = null;
        grid_row.refresh();
        frm.dirty();
        frm.save();
        reset();
        dialog.hide();
        location.reload();
    });

    function initializeTimer() {
        interval = setInterval(function () {
            var current = setCurrentIncrement();
            updateStopwatch(current);
        }, 1000);

        // Save the live_timer every 30 seconds
        saveInterval = setInterval(function () {
            var grid_row = frm.fields_dict["time_logs"].grid.get_row(row.idx - 1);
            grid_row.doc.live_timer = formatTime(currentIncrement);
            grid_row.refresh();
            frm.dirty(); // Mark the form as dirty to trigger save
            frm.save();  // Save changes to the database
        }, 10000); // 10 seconds
    }

    function updateStopwatch(increment) {
        var hours = Math.floor(increment / 3600);
        var minutes = Math.floor((increment - hours * 3600) / 60);
        var seconds = increment - hours * 3600 - minutes * 60;

        if (hours > 99999) reset();
        if (cur_dialog && cur_dialog.get_value("expected_hours") > 0) {
            if (flag && currentIncrement >= cur_dialog.get_value("expected_hours") * 3600) {
                frappe.utils.play_sound("alert");
                frappe.msgprint(__("Timer exceeded the given hours."));
                flag = false;
            }
        }

        $(".hours").text(hours < 10 ? "0" + hours.toString() : hours.toString());
        $(".minutes").text(minutes < 10 ? "0" + minutes.toString() : minutes.toString());
        $(".seconds").text(seconds < 10 ? "0" + seconds.toString() : seconds.toString());
    }

    function formatTime(increment) {
        var hours = Math.floor(increment / 3600);
        var minutes = Math.floor((increment - hours * 3600) / 60);
        var seconds = increment - hours * 3600 - minutes * 60;

        return (hours < 10 ? "0" : "") + hours + ":" +
               (minutes < 10 ? "0" : "") + minutes + ":" +
               (seconds < 10 ? "0" : "") + seconds;
    }

    function setCurrentIncrement() {
        currentIncrement += 1;
        return currentIncrement;
    }

    function reset() {
        currentIncrement = 0;
        clearInterval(interval);
        clearInterval(saveInterval); // Clear the save interval
        $(".hours").text("00");
        $(".minutes").text("00");
        $(".seconds").text("00");
        $btn_complete.hide();
        $btn_start.show();
    }
};

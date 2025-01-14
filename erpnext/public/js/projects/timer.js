frappe.provide("erpnext.timesheet");

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
                onchange: function () {
                    set_billable_non_billable(dialog);
                },
            },
            {
                fieldtype: "Link",
                label: __("Task Element"),
                fieldname: "custom_task_element",
                options: "Task Element",
            },

            { fieldtype: "Int", label: __("Count"), fieldname: "custom_count" },
            { fieldtype: "Float", label: __("Expected Hrs"), fieldname: "expected_hours" },
            { fieldtype: "Section Break" },
            { fieldtype: "Check", label: __("Is Billable"), fieldname: "is_billable" },
            { fieldtype: "Column Break" },
            { fieldtype: "Check", label: __("Non-Billable"), fieldname: "custom_non_billable" },
            { fieldtype: "Section Break" },
            { fieldtype: "HTML", fieldname: "timer_html" },
        ],
    });

    if (row) {
        dialog.set_values({
            activity_type: row.activity_type,
            custom_task_element: row.custom_task_element,
            custom_count: row.custom_count,
            is_billable: row.is_billable,
            custom_non_billable: row.custom_non_billable,
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
                <button class="btn btn-danger btn-pause"> ${__("Stop")} </button>
                <button class="btn btn-warning btn-resume"> ${__("Resume")} </button>
                <button class="btn btn-primary btn-complete"> ${__("Complete")} </button>
            </div>
        `;
    }

    // Initialize buttons visibility
    erpnext.timesheet.control_timer(frm, dialog, row, timestamp);
    dialog.show();
};

// Function to handle billable and non-billable logic
function set_billable_non_billable(dialog) {
    const non_billable_types = [
        "Corrections /Rework",
        "Job Study",
        "RFI Preparation",
        "BFA Review",
        "Changes Review",
        "Co-ordination",
        "Project Discussion",
        "Meeting",
        "Break",
    ];

    let activity_type = dialog.get_value("activity_type");
    if (non_billable_types.includes(activity_type)) {
        dialog.set_value("custom_non_billable", 1);
        dialog.set_value("is_billable", 0);
    } else {
        dialog.set_value("custom_non_billable", 0);
        dialog.set_value("is_billable", 1);
    }
}

erpnext.timesheet.control_timer = function (frm, dialog, row, timestamp = 0) {
    var $btn_start = dialog.$wrapper.find(".playpause .btn-start");
    var $btn_pause = dialog.$wrapper.find(".playpause .btn-pause");
    var $btn_resume = dialog.$wrapper.find(".playpause .btn-resume");
    var $btn_complete = dialog.$wrapper.find(".playpause .btn-complete");
    var interval = null;

    var currentIncrement = (row && row.current_increment) || timestamp; // Default to timestamp
    var isPaused = (row && row.is_paused) || false; 
    var initialized = row ? true : false;

        dialog.onhide = function () {
         if (isPaused) { // Check if isPaused is true
        if (row) {
            row.is_paused = isPaused; // Save the paused state
            row.current_increment = currentIncrement; // Save the current timer value
            row.custom_timer_status = "Paused"; // Update status to "Paused"

            frm.refresh_field("time_logs"); // Update the child table in the parent document
           // frm.save(); // Save changes to the database
        }
    }
};

    // Initialize button states
    $btn_pause.hide();
    $btn_resume.hide();
    $btn_complete.hide();

    if (row) {
        initialized = true;
        $btn_start.hide();
        $btn_complete.show();
        if (isPaused) {
            $btn_resume.show();
        } else {
            $btn_pause.show();
            initializeTimer();
        }
    }

    $btn_start.click(function () {
        if (!initialized) {
            var args = dialog.get_values();
            if (!args) return;
            if (
                frm.doc.time_logs.length === 1 &&
                !frm.doc.time_logs[0].activity_type &&
                !frm.doc.time_logs[0].from_time
            ) {
                frm.doc.time_logs = [];
            }
            row = frappe.model.add_child(frm.doc, "Timesheet Detail", "time_logs");

            row.activity_type = args.activity_type;
            row.is_billable = args.is_billable;
            row.custom_non_billable = args.custom_non_billable;
            row.custom_count = args.custom_count;
            row.custom_task_element = args.custom_task_element;
            row.from_time = frappe.datetime.get_datetime_as_string();
            row.expected_hours = args.expected_hours;
            row.completed = 0;
            row.custom_timer_status = "Active";
            frm.set_value("custom_timer_status", "Active");
           // frm.script_manager.trigger("custom_timer_status", row.doctype, row.name);

            row.project_name = frm.doc.custom_project_name || "";

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
            $btn_pause.show();
            $btn_complete.show();
            initializeTimer();
        }
    });

    $btn_pause.click(function () {
        isPaused = true;
        row.is_paused = true; // Persist the paused state
        row.current_increment = currentIncrement; // Persist the current increment
        row.custom_timer_status = "Paused";  // Set status as Paused in child table
        frm.set_value("custom_timer_status", "Paused");  // this set a timer status in parent
        frm.save();  // Save the row with paused time and status

        clearInterval(interval);
        //frm.refresh_field("time_logs"); // Save the state in the form
        $btn_pause.hide();
        $btn_resume.show();
    });

    $btn_resume.click(function () {
        isPaused = false;
        row.is_paused = false; // Update the paused state
       // frm.refresh_field("time_logs"); // Save the state in the form
        row.custom_timer_status = "Active";  // Set status as Active in child table
        frm.set_value("custom_timer_status", "Active");  // this set a timer status in parent
        frm.save();  // Save the updated status
        initializeTimer();
        $btn_resume.hide();
        $btn_pause.show();
    });

    $btn_complete.click(function () {
        var grid_row = cur_frm.fields_dict["time_logs"].grid.get_row(row.idx - 1);
        var args = dialog.get_values();
        grid_row.doc.completed = 1;
        grid_row.doc.activity_type = args.activity_type;
        grid_row.doc.is_billable = args.is_billable;
        grid_row.doc.custom_non_billable = args.custom_non_billable;
        grid_row.doc.custom_count = args.custom_count;
        grid_row.doc.custom_task_element = args.custom_task_element;
        grid_row.doc.expected_hours = args.expected_hours;
        grid_row.doc.hours = currentIncrement / 3600;
        grid_row.doc.to_time = frappe.datetime.now_datetime();
        grid_row.doc.live_timer = formatTime(currentIncrement);
        grid_row.doc.custom_timer_status = null;
        frm.set_value("custom_timer_status", null);
       // frm.script_manager.trigger("custom_timer_status", row.doctype, row.name);

        grid_row.refresh();
        frm.dirty();
        frm.save();
        reset();
        dialog.hide();
    });

    function initializeTimer() {
        interval = setInterval(function () {
            if (!isPaused) {
                var current = setCurrentIncrement();
                updateStopwatch(current);
            }
        }, 1000);
    }

    function updateStopwatch(increment) {
        var hours = Math.floor(increment / 3600);
        var minutes = Math.floor((increment - hours * 3600) / 60);
        var seconds = increment - hours * 3600 - minutes * 60;

        if (!$(".modal-dialog").is(":visible")) {
            reset();
        }
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

              return (
               (hours < 10 ? "0" : "") +
               hours +
             ":" +
               (minutes < 10 ? "0" : "") +
               minutes +
             ":" +
              (seconds < 10 ? "0" : "") +
              seconds
        );
     }

    function setCurrentIncrement() {
        currentIncrement += 1;
        return currentIncrement;
    }

    function reset() {
        currentIncrement = 0;
        initialized = false;
        clearInterval(interval);
        $(".hours").text("00");
        $(".minutes").text("00");
        $(".seconds").text("00");
        $btn_complete.hide();
        $btn_pause.hide();
        $btn_resume.hide();
        $btn_start.show();
    }
};

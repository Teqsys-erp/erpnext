// Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Template", {
	// refresh: function(frm) {

	// }
	setup: function (frm) {
		frm.set_query("task", "tasks", function () {
			return {
				filters: {
					is_template: 1,
				},
			};
		});
	},
});

frappe.ui.form.on("Project Template Task", {
        task: function (frm, cdt, cdn) {
                var row = locals[cdt][cdn];
                frappe.db.get_value("Task", row.task, ["subject", "custom_activity_for", "custom_category"], (value) => {
                        row.subject = value.subject;
                        row.custom_activity_for = value.custom_activity_for;
                        row.custom_category = value.custom_category;
                        refresh_field("tasks");
                });
        },
});


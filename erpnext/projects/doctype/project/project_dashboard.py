from frappe import _


def get_data():
	return {
		"heatmap": True,
		"heatmap_message": _("This is based on the Time Sheets created against this project"),
		"fieldname": "project",
		"transactions": [
			{
				"label": _("Project"),
				"items": ["Task", "Timesheet", "Project Update"],
			},
			{"label": _("Sales"), "items": ["Sales Order", "Delivery Note", "Sales Invoice"]}
		],
	}

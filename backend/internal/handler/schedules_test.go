package handler

import (
	"net/http"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func createTestGroup(t *testing.T, e *echo.Echo, token string, name string) map[string]any {
	t.Helper()

	rec := performRequestWithToken(e, http.MethodPost, "/api/task-groups", `{"name":"`+name+`"}`, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create group status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	return decodeResponse(t, rec)
}

func createTestSchedule(t *testing.T, e *echo.Echo, token string, body string) map[string]any {
	t.Helper()

	rec := performRequestWithToken(e, http.MethodPost, "/api/schedules", body, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create schedule status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	return decodeResponse(t, rec)
}

func TestCreateSchedule(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "schedule-create@example.com")
	group := createTestGroup(t, e, token, "OS")
	groupID := group["id"].(string)

	schedule := createTestSchedule(t, e, token, `{
		"group_id":"`+groupID+`",
		"title":"OS work",
		"location_name":"  Library  ",
		"start_time":"2026-06-02T10:00:00+09:00",
		"end_time":"2026-06-02T12:00:00+09:00"
	}`)

	if schedule["title"] != "OS work" {
		t.Fatalf("title = %v, want OS work", schedule["title"])
	}
	if schedule["group_id"] != groupID {
		t.Fatalf("group_id = %v, want %s", schedule["group_id"], groupID)
	}
	if schedule["location_name"] != "Library" {
		t.Fatalf("location_name = %v, want Library", schedule["location_name"])
	}
}

func TestScheduleAPIsRequireAuth(t *testing.T) {
	e, _ := newTaskTestServer(t)

	tests := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "list", method: http.MethodGet, path: "/api/schedules"},
		{name: "create", method: http.MethodPost, path: "/api/schedules", body: `{}`},
		{name: "patch", method: http.MethodPatch, path: "/api/schedules/00000000-0000-0000-0000-000000000000", body: `{}`},
		{name: "delete", method: http.MethodDelete, path: "/api/schedules/00000000-0000-0000-0000-000000000000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := performRequest(e, tt.method, tt.path, tt.body)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusUnauthorized, rec.Body.String())
			}
			if got := errorCode(t, rec); got != "unauthorized" {
				t.Fatalf("error code = %s, want unauthorized", got)
			}
		})
	}
}

func TestScheduleValidation(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "schedule-validation@example.com")
	group := createTestGroup(t, e, token, "OS")
	groupID := group["id"].(string)

	tests := []struct {
		name string
		body string
	}{
		{
			name: "missing group",
			body: `{
				"title":"OS work",
				"start_time":"2026-06-02T10:00:00+09:00",
				"end_time":"2026-06-02T12:00:00+09:00"
			}`,
		},
		{
			name: "invalid time",
			body: `{
				"group_id":"` + groupID + `",
				"title":"OS work",
				"start_time":"not-a-date",
				"end_time":"2026-06-02T12:00:00+09:00"
			}`,
		},
		{
			name: "end before start",
			body: `{
				"group_id":"` + groupID + `",
				"title":"OS work",
				"start_time":"2026-06-02T12:00:00+09:00",
				"end_time":"2026-06-02T10:00:00+09:00"
			}`,
		},
		{
			name: "location too long",
			body: `{
				"group_id":"` + groupID + `",
				"title":"OS work",
				"location_name":"` + strings.Repeat("a", 256) + `",
				"start_time":"2026-06-02T10:00:00+09:00",
				"end_time":"2026-06-02T12:00:00+09:00"
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := performRequestWithToken(e, http.MethodPost, "/api/schedules", tt.body, token)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
			if got := errorCode(t, rec); got != "validation_error" {
				t.Fatalf("error code = %s, want validation_error", got)
			}
		})
	}
}

func TestSchedulesAreScopedByUser(t *testing.T) {
	e, _ := newTaskTestServer(t)
	tokenA := registerTestUser(t, e, "schedule-user-a@example.com")
	tokenB := registerTestUser(t, e, "schedule-user-b@example.com")
	groupA := createTestGroup(t, e, tokenA, "OS")
	groupB := createTestGroup(t, e, tokenB, "Circuit")
	groupAID := groupA["id"].(string)
	groupBID := groupB["id"].(string)

	scheduleA := createTestSchedule(t, e, tokenA, `{
		"group_id":"`+groupAID+`",
		"title":"user A schedule",
		"start_time":"2026-06-02T10:00:00+09:00",
		"end_time":"2026-06-02T12:00:00+09:00"
	}`)
	scheduleAID := scheduleA["id"].(string)

	listA := performRequestWithToken(e, http.MethodGet, "/api/schedules", "", tokenA)
	if listA.Code != http.StatusOK {
		t.Fatalf("list A status = %d, want %d, body: %s", listA.Code, http.StatusOK, listA.Body.String())
	}
	if !strings.Contains(listA.Body.String(), "user A schedule") {
		t.Fatalf("user A schedule missing from own list: %s", listA.Body.String())
	}

	listB := performRequestWithToken(e, http.MethodGet, "/api/schedules", "", tokenB)
	if listB.Code != http.StatusOK {
		t.Fatalf("list B status = %d, want %d, body: %s", listB.Code, http.StatusOK, listB.Body.String())
	}
	if strings.Contains(listB.Body.String(), "user A schedule") {
		t.Fatalf("user B can see user A schedule: %s", listB.Body.String())
	}

	updateB := performRequestWithToken(e, http.MethodPatch, "/api/schedules/"+scheduleAID, `{"title":"stolen"}`, tokenB)
	if updateB.Code != http.StatusNotFound {
		t.Fatalf("update B status = %d, want %d, body: %s", updateB.Code, http.StatusNotFound, updateB.Body.String())
	}

	createWithOtherGroup := performRequestWithToken(e, http.MethodPost, "/api/schedules", `{
		"group_id":"`+groupAID+`",
		"title":"bad schedule",
		"start_time":"2026-06-02T10:00:00+09:00",
		"end_time":"2026-06-02T12:00:00+09:00"
	}`, tokenB)
	if createWithOtherGroup.Code != http.StatusBadRequest {
		t.Fatalf("create with other group status = %d, want %d, body: %s", createWithOtherGroup.Code, http.StatusBadRequest, createWithOtherGroup.Body.String())
	}

	createTestSchedule(t, e, tokenB, `{
		"group_id":"`+groupBID+`",
		"title":"user B schedule",
		"start_time":"2026-06-02T13:00:00+09:00",
		"end_time":"2026-06-02T14:00:00+09:00"
	}`)
	filteredB := performRequestWithToken(e, http.MethodGet, "/api/schedules?group_id="+groupBID, "", tokenB)
	if filteredB.Code != http.StatusOK {
		t.Fatalf("filtered B status = %d, want %d, body: %s", filteredB.Code, http.StatusOK, filteredB.Body.String())
	}
	if !strings.Contains(filteredB.Body.String(), "user B schedule") {
		t.Fatalf("filtered B missing own schedule: %s", filteredB.Body.String())
	}
}

func TestExportICSSchedules(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "schedule-export@example.com")
	group := createTestGroup(t, e, token, "OS")
	groupID := group["id"].(string)

	createTestTask(t, e, token, `{
		"title":"task should not be exported",
		"deadline":"2026-06-02T09:00:00+09:00",
		"estimated_minutes":30,
		"weight":1
	}`)
	createTestSchedule(t, e, token, `{
		"group_id":"`+groupID+`",
		"title":"OS, work; review",
		"location_name":"Lab, A",
		"start_time":"2026-06-02T10:00:00+09:00",
		"end_time":"2026-06-02T12:00:00+09:00"
	}`)

	rec := performRequestWithToken(e, http.MethodGet, "/api/export/ics", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, "BEGIN:VCALENDAR\r\n") {
		t.Fatalf("VCALENDAR missing: %s", body)
	}
	if !strings.Contains(body, "SUMMARY:OS\\, work\\; review\r\n") {
		t.Fatalf("SUMMARY missing or not escaped: %s", body)
	}
	if !strings.Contains(body, "LOCATION:Lab\\, A\r\n") {
		t.Fatalf("LOCATION missing or not escaped: %s", body)
	}
	if !strings.Contains(body, "DTSTART:20260602T010000Z\r\n") {
		t.Fatalf("DTSTART missing: %s", body)
	}
	if !strings.Contains(body, "DTEND:20260602T030000Z\r\n") {
		t.Fatalf("DTEND missing: %s", body)
	}
	if strings.Contains(body, "task should not be exported") {
		t.Fatalf("task was exported: %s", body)
	}
}

func TestUpdateAndDeleteSchedule(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "schedule-update@example.com")
	group := createTestGroup(t, e, token, "OS")
	groupID := group["id"].(string)
	schedule := createTestSchedule(t, e, token, `{
		"group_id":"`+groupID+`",
		"title":"before",
		"location_name":"Home",
		"start_time":"2026-06-02T10:00:00+09:00",
		"end_time":"2026-06-02T12:00:00+09:00"
	}`)
	scheduleID := schedule["id"].(string)

	update := performRequestWithToken(e, http.MethodPatch, "/api/schedules/"+scheduleID, `{"title":"after"}`, token)
	if update.Code != http.StatusOK {
		t.Fatalf("update status = %d, want %d, body: %s", update.Code, http.StatusOK, update.Body.String())
	}
	updated := decodeResponse(t, update)
	if updated["title"] != "after" {
		t.Fatalf("title = %v, want after", updated["title"])
	}
	if updated["location_name"] != "Home" {
		t.Fatalf("location_name = %v, want Home", updated["location_name"])
	}

	updateLocation := performRequestWithToken(e, http.MethodPatch, "/api/schedules/"+scheduleID, `{"location_name":" Station "}`, token)
	if updateLocation.Code != http.StatusOK {
		t.Fatalf("update location status = %d, want %d, body: %s", updateLocation.Code, http.StatusOK, updateLocation.Body.String())
	}
	updated = decodeResponse(t, updateLocation)
	if updated["location_name"] != "Station" {
		t.Fatalf("location_name = %v, want Station", updated["location_name"])
	}

	clearLocation := performRequestWithToken(e, http.MethodPatch, "/api/schedules/"+scheduleID, `{"location_name":""}`, token)
	if clearLocation.Code != http.StatusOK {
		t.Fatalf("clear location status = %d, want %d, body: %s", clearLocation.Code, http.StatusOK, clearLocation.Body.String())
	}
	updated = decodeResponse(t, clearLocation)
	if updated["location_name"] != nil {
		t.Fatalf("location_name = %v, want nil", updated["location_name"])
	}

	deleteRec := performRequestWithToken(e, http.MethodDelete, "/api/schedules/"+scheduleID, "", token)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want %d, body: %s", deleteRec.Code, http.StatusNoContent, deleteRec.Body.String())
	}

	deleteAgain := performRequestWithToken(e, http.MethodDelete, "/api/schedules/"+scheduleID, "", token)
	if deleteAgain.Code != http.StatusNotFound {
		t.Fatalf("delete again status = %d, want %d, body: %s", deleteAgain.Code, http.StatusNotFound, deleteAgain.Body.String())
	}
}

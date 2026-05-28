package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nexttask/backend/internal/model"
	"nexttask/backend/internal/repository"

	"github.com/labstack/echo/v4"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTaskTestServer(t *testing.T) (*echo.Echo, *gorm.DB) {
	t.Helper()

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql database: %v", err)
	}
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Fatalf("close test database: %v", err)
		}
	})
	if err := repository.Migrate(db); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	e := echo.New()
	e.HTTPErrorHandler = HTTPErrorHandler
	RegisterRoutes(e, db)

	return e, db
}

func performRequest(e *echo.Echo, method string, path string, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func decodeResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.NewDecoder(bytes.NewReader(rec.Body.Bytes())).Decode(&body); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, rec.Body.String())
	}
	return body
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()

	body := decodeResponse(t, rec)
	errBody, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("response has no error object: %#v", body)
	}
	code, ok := errBody["code"].(string)
	if !ok {
		t.Fatalf("response has no error code: %#v", body)
	}
	return code
}

func createTestTask(t *testing.T, e *echo.Echo, body string) map[string]any {
	t.Helper()

	rec := performRequest(e, http.MethodPost, "/api/tasks", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	return decodeResponse(t, rec)
}

func TestCreateTask(t *testing.T) {
	e, _ := newTaskTestServer(t)

	task := createTestTask(t, e, `{
		"title":"OS report",
		"description":"initial",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)

	if task["title"] != "OS report" {
		t.Fatalf("title = %v, want OS report", task["title"])
	}
	if task["status"] != string(model.TaskStatusOpen) {
		t.Fatalf("status = %v, want open", task["status"])
	}
}

func TestCreateTaskValidationErrors(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "missing title",
			body: `{
				"deadline":"2026-06-01T23:59:00+09:00",
				"estimated_minutes":120,
				"weight":5
			}`,
		},
		{
			name: "invalid deadline",
			body: `{
				"title":"OS report",
				"deadline":"not-a-date",
				"estimated_minutes":120,
				"weight":5
			}`,
		},
		{
			name: "invalid group id",
			body: `{
				"title":"OS report",
				"deadline":"2026-06-01T23:59:00+09:00",
				"estimated_minutes":120,
				"weight":5,
				"group_id":"not-a-uuid"
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, _ := newTaskTestServer(t)
			rec := performRequest(e, http.MethodPost, "/api/tasks", tt.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
			if got := errorCode(t, rec); got != "validation_error" {
				t.Fatalf("error code = %s, want validation_error", got)
			}
		})
	}
}

func TestPatchTaskUpdatesOnlyProvidedFields(t *testing.T) {
	e, _ := newTaskTestServer(t)
	task := createTestTask(t, e, `{
		"title":"before",
		"description":"keep me",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)
	id := task["id"].(string)

	rec := performRequest(e, http.MethodPatch, "/api/tasks/"+id, `{"title":"after"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	updated := decodeResponse(t, rec)
	if updated["title"] != "after" {
		t.Fatalf("title = %v, want after", updated["title"])
	}
	if updated["description"] != "keep me" {
		t.Fatalf("description = %v, want keep me", updated["description"])
	}
	if updated["estimated_minutes"] != float64(120) {
		t.Fatalf("estimated_minutes = %v, want 120", updated["estimated_minutes"])
	}
}

func TestPatchTaskValidationAndNotFound(t *testing.T) {
	e, _ := newTaskTestServer(t)
	task := createTestTask(t, e, `{
		"title":"before",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)
	id := task["id"].(string)

	rec := performRequest(e, http.MethodPatch, "/api/tasks/"+id, `{"status":"bad"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "validation_error" {
		t.Fatalf("error code = %s, want validation_error", got)
	}

	rec = performRequest(e, http.MethodPatch, "/api/tasks/00000000-0000-0000-0000-000000000000", `{"title":"missing"}`)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusNotFound, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "not_found" {
		t.Fatalf("error code = %s, want not_found", got)
	}
}

func TestDeleteTaskNotFound(t *testing.T) {
	e, _ := newTaskTestServer(t)

	rec := performRequest(e, http.MethodDelete, "/api/tasks/00000000-0000-0000-0000-000000000000", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusNotFound, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "not_found" {
		t.Fatalf("error code = %s, want not_found", got)
	}
}

func TestListTasksInvalidStatus(t *testing.T) {
	e, _ := newTaskTestServer(t)

	rec := performRequest(e, http.MethodGet, "/api/tasks?status=bad", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "validation_error" {
		t.Fatalf("error code = %s, want validation_error", got)
	}
}

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
	RegisterRoutes(e, db, "test-jwt-secret")

	return e, db
}

func performRequest(e *echo.Echo, method string, path string, body string) *httptest.ResponseRecorder {
	return performRequestWithToken(e, method, path, body, "")
}

func performRequestWithToken(e *echo.Echo, method string, path string, body string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
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

func registerTestUser(t *testing.T, e *echo.Echo, email string) string {
	t.Helper()

	rec := performRequest(e, http.MethodPost, "/api/auth/register", `{
		"name":"Test User",
		"email":"`+email+`",
		"password":"password123"
	}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("register user status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	body := decodeResponse(t, rec)
	token, ok := body["token"].(string)
	if !ok || token == "" {
		t.Fatalf("token is missing: %#v", body)
	}
	return token
}

func createTestTask(t *testing.T, e *echo.Echo, token string, body string) map[string]any {
	t.Helper()

	rec := performRequestWithToken(e, http.MethodPost, "/api/tasks", body, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	return decodeResponse(t, rec)
}

func TestCreateTask(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "task-create@example.com")

	task := createTestTask(t, e, token, `{
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
			token := registerTestUser(t, e, "task-validation-"+strings.ReplaceAll(tt.name, " ", "-")+"@example.com")
			rec := performRequestWithToken(e, http.MethodPost, "/api/tasks", tt.body, token)
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
	token := registerTestUser(t, e, "task-patch@example.com")
	task := createTestTask(t, e, token, `{
		"title":"before",
		"description":"keep me",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)
	id := task["id"].(string)

	rec := performRequestWithToken(e, http.MethodPatch, "/api/tasks/"+id, `{"title":"after"}`, token)
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
	token := registerTestUser(t, e, "task-patch-validation@example.com")
	task := createTestTask(t, e, token, `{
		"title":"before",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)
	id := task["id"].(string)

	rec := performRequestWithToken(e, http.MethodPatch, "/api/tasks/"+id, `{"status":"bad"}`, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "validation_error" {
		t.Fatalf("error code = %s, want validation_error", got)
	}

	rec = performRequestWithToken(e, http.MethodPatch, "/api/tasks/00000000-0000-0000-0000-000000000000", `{"title":"missing"}`, token)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusNotFound, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "not_found" {
		t.Fatalf("error code = %s, want not_found", got)
	}
}

func TestDeleteTaskNotFound(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "task-delete@example.com")

	rec := performRequestWithToken(e, http.MethodDelete, "/api/tasks/00000000-0000-0000-0000-000000000000", "", token)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusNotFound, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "not_found" {
		t.Fatalf("error code = %s, want not_found", got)
	}
}

func TestListTasksInvalidStatus(t *testing.T) {
	e, _ := newTaskTestServer(t)
	token := registerTestUser(t, e, "task-list@example.com")

	rec := performRequestWithToken(e, http.MethodGet, "/api/tasks?status=bad", "", token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "validation_error" {
		t.Fatalf("error code = %s, want validation_error", got)
	}
}

func TestTaskAPIsRequireAuth(t *testing.T) {
	e, _ := newTaskTestServer(t)

	tests := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "list tasks", method: http.MethodGet, path: "/api/tasks"},
		{name: "create task", method: http.MethodPost, path: "/api/tasks", body: `{}`},
		{name: "patch task", method: http.MethodPatch, path: "/api/tasks/00000000-0000-0000-0000-000000000000", body: `{}`},
		{name: "delete task", method: http.MethodDelete, path: "/api/tasks/00000000-0000-0000-0000-000000000000"},
		{name: "list groups", method: http.MethodGet, path: "/api/task-groups"},
		{name: "export ics", method: http.MethodGet, path: "/api/export/ics"},
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

func TestTasksAreScopedByUser(t *testing.T) {
	e, _ := newTaskTestServer(t)
	tokenA := registerTestUser(t, e, "task-user-a@example.com")
	tokenB := registerTestUser(t, e, "task-user-b@example.com")

	taskA := createTestTask(t, e, tokenA, `{
		"title":"user A task",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":120,
		"weight":5
	}`)
	idA := taskA["id"].(string)

	listA := performRequestWithToken(e, http.MethodGet, "/api/tasks", "", tokenA)
	if listA.Code != http.StatusOK {
		t.Fatalf("list A status = %d, want %d, body: %s", listA.Code, http.StatusOK, listA.Body.String())
	}
	if !strings.Contains(listA.Body.String(), "user A task") {
		t.Fatalf("user A task missing from own list: %s", listA.Body.String())
	}

	listB := performRequestWithToken(e, http.MethodGet, "/api/tasks", "", tokenB)
	if listB.Code != http.StatusOK {
		t.Fatalf("list B status = %d, want %d, body: %s", listB.Code, http.StatusOK, listB.Body.String())
	}
	if strings.Contains(listB.Body.String(), "user A task") {
		t.Fatalf("user B can see user A task: %s", listB.Body.String())
	}

	patchB := performRequestWithToken(e, http.MethodPatch, "/api/tasks/"+idA, `{"title":"stolen"}`, tokenB)
	if patchB.Code != http.StatusNotFound {
		t.Fatalf("patch B status = %d, want %d, body: %s", patchB.Code, http.StatusNotFound, patchB.Body.String())
	}
}

func TestTaskGroupIsScopedByUser(t *testing.T) {
	e, _ := newTaskTestServer(t)
	tokenA := registerTestUser(t, e, "group-user-a@example.com")
	tokenB := registerTestUser(t, e, "group-user-b@example.com")

	groupRec := performRequestWithToken(e, http.MethodPost, "/api/task-groups", `{"name":"OS"}`, tokenA)
	if groupRec.Code != http.StatusCreated {
		t.Fatalf("create group status = %d, want %d, body: %s", groupRec.Code, http.StatusCreated, groupRec.Body.String())
	}
	group := decodeResponse(t, groupRec)
	groupID := group["id"].(string)

	createWithOtherUserGroup := performRequestWithToken(e, http.MethodPost, "/api/tasks", `{
		"title":"bad group",
		"deadline":"2026-06-01T23:59:00+09:00",
		"estimated_minutes":60,
		"weight":3,
		"group_id":"`+groupID+`"
	}`, tokenB)
	if createWithOtherUserGroup.Code != http.StatusBadRequest {
		t.Fatalf("create with other user group status = %d, want %d, body: %s", createWithOtherUserGroup.Code, http.StatusBadRequest, createWithOtherUserGroup.Body.String())
	}
	if got := errorCode(t, createWithOtherUserGroup); got != "validation_error" {
		t.Fatalf("error code = %s, want validation_error", got)
	}
}

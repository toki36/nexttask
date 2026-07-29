package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"nexttask/backend/internal/model"
	"nexttask/backend/internal/priority"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type createTaskRequest struct {
	GroupID          *string `json:"group_id"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	LocationName     *string `json:"location_name"`
	StartTime        *string `json:"start_time"`
	Deadline         string  `json:"deadline"`
	EstimatedMinutes int     `json:"estimated_minutes"`
	Importance       *int    `json:"importance"`
}

type updateTaskRequest struct {
	GroupID          *string `json:"group_id"`
	Title            *string `json:"title"`
	Description      *string `json:"description"`
	LocationName     *string `json:"location_name"`
	StartTime        *string `json:"start_time"`
	Deadline         *string `json:"deadline"`
	EstimatedMinutes *int    `json:"estimated_minutes"`
	Importance       *int    `json:"importance"`
	Status           *string `json:"status"`
	locationNameSet  bool
	startTimeSet     bool
}

func (h *Handler) ListTasks(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	var tasks []model.Task
	query := h.db.Preload("Group").Where("user_id = ?", userID).Order("priority_score desc").Order("deadline asc")
	if groupID := c.QueryParam("group_id"); groupID != "" {
		query = query.Where("group_id = ?", groupID)
	}
	if status := c.QueryParam("status"); status != "" {
		if !isValidTaskStatus(status) {
			return errorResponse(c, http.StatusBadRequest, "validation_error", "status must be open or completed")
		}
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&tasks).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, tasks)
}

func (h *Handler) CreateTask(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	req, err := bindCreateTaskRequest(c)
	if err != nil {
		return err
	}
	task, err := h.taskFromCreateRequest(c, userID, req)
	if err != nil {
		return err
	}
	id, err := newID()
	if err != nil {
		return err
	}
	task.ID = id
	task.Status = model.TaskStatusOpen
	task.PriorityScore = priority.Score(task, time.Now())
	if err := h.db.Create(&task).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, task)
}

func (h *Handler) UpdateTask(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	req, err := bindUpdateTaskRequest(c)
	if err != nil {
		return err
	}
	var task model.Task
	if err := h.db.First(&task, "id = ? AND user_id = ?", c.Param("id"), userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "not_found", "task not found")
		}
		return err
	}
	task, err = h.applyTaskUpdateRequest(c, userID, req, task)
	if err != nil {
		return err
	}
	task.PriorityScore = priority.Score(task, time.Now())
	if err := h.db.Save(&task).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, task)
}

func (h *Handler) DeleteTask(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	result := h.db.Delete(&model.Task{}, "id = ? AND user_id = ?", c.Param("id"), userID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errorResponse(c, http.StatusNotFound, "not_found", "task not found")
	}
	return c.NoContent(http.StatusNoContent)
}

func bindCreateTaskRequest(c echo.Context) (createTaskRequest, error) {
	var req createTaskRequest
	if err := c.Bind(&req); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	if err := normalizeGroupID(c, &req.GroupID); err != nil {
		return req, err
	}
	if err := normalizeLocationName(c, &req.LocationName); err != nil {
		return req, err
	}
	req.Title = strings.TrimSpace(req.Title)
	if err := normalizeOptionalTaskTime(c, &req.StartTime, "start_time"); err != nil {
		return req, err
	}
	req.Deadline = strings.TrimSpace(req.Deadline)
	if req.Title == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "title is required")
	}
	if req.Deadline == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline is required")
	}
	if req.EstimatedMinutes <= 0 {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "estimated_minutes must be greater than 0")
	}
	if req.Importance == nil {
		normal := 2
		req.Importance = &normal
	}
	if !isValidImportance(*req.Importance) {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "importance must be between 1 and 3")
	}
	return req, nil
}

func bindUpdateTaskRequest(c echo.Context) (updateTaskRequest, error) {
	var req updateTaskRequest
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	if _, ok := fields["location_name"]; ok {
		req.locationNameSet = true
		if req.LocationName == nil {
			empty := ""
			req.LocationName = &empty
		}
	}
	if _, ok := fields["start_time"]; ok {
		req.startTimeSet = true
	}
	if err := normalizeGroupID(c, &req.GroupID); err != nil {
		return req, err
	}
	if err := normalizeLocationName(c, &req.LocationName); err != nil {
		return req, err
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "title must not be empty")
		}
		req.Title = &title
	}
	if err := normalizeOptionalTaskTime(c, &req.StartTime, "start_time"); err != nil {
		return req, err
	}
	if req.Deadline != nil {
		deadline := strings.TrimSpace(*req.Deadline)
		if deadline == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must not be empty")
		}
		if _, err := time.Parse(time.RFC3339, deadline); err != nil {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must be RFC3339")
		}
		req.Deadline = &deadline
	}
	if req.EstimatedMinutes != nil && *req.EstimatedMinutes <= 0 {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "estimated_minutes must be greater than 0")
	}
	if req.Importance != nil && !isValidImportance(*req.Importance) {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "importance must be between 1 and 3")
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if !isValidTaskStatus(status) {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "status must be open or completed")
		}
		req.Status = &status
	}
	return req, nil
}

func (h *Handler) taskFromCreateRequest(c echo.Context, userID string, req createTaskRequest) (model.Task, error) {
	task := model.Task{}
	deadline, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		return task, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must be RFC3339")
	}
	startTime, err := parseOptionalTaskTime(c, req.StartTime, "start_time")
	if err != nil {
		return task, err
	}
	if startTime != nil && !deadline.After(*startTime) {
		return task, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must be after start_time")
	}
	if err := h.ensureTaskGroupExists(c, userID, req.GroupID); err != nil {
		return task, err
	}
	task.UserID = userID
	task.GroupID = req.GroupID
	task.Title = req.Title
	task.Description = req.Description
	task.LocationName = req.LocationName
	task.StartTime = startTime
	task.Deadline = deadline
	task.EstimatedMinutes = req.EstimatedMinutes
	task.Importance = *req.Importance
	task.Status = model.TaskStatusOpen
	return task, nil
}

func (h *Handler) applyTaskUpdateRequest(c echo.Context, userID string, req updateTaskRequest, task model.Task) (model.Task, error) {
	if req.GroupID != nil {
		if err := h.ensureTaskGroupExists(c, userID, req.GroupID); err != nil {
			return task, err
		}
		task.GroupID = req.GroupID
	}
	if req.Title != nil {
		task.Title = *req.Title
	}
	if req.Description != nil {
		task.Description = *req.Description
	}
	if req.locationNameSet {
		task.LocationName = req.LocationName
	}
	if req.startTimeSet {
		startTime, err := parseOptionalTaskTime(c, req.StartTime, "start_time")
		if err != nil {
			return task, err
		}
		task.StartTime = startTime
	}
	if req.Deadline != nil {
		deadline, err := time.Parse(time.RFC3339, *req.Deadline)
		if err != nil {
			return task, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must be RFC3339")
		}
		task.Deadline = deadline
	}
	if task.StartTime != nil && !task.Deadline.After(*task.StartTime) {
		return task, errorResponse(c, http.StatusBadRequest, "validation_error", "deadline must be after start_time")
	}
	if req.EstimatedMinutes != nil {
		task.EstimatedMinutes = *req.EstimatedMinutes
	}
	if req.Importance != nil {
		task.Importance = *req.Importance
	}
	if req.Status != nil {
		switch *req.Status {
		case string(model.TaskStatusCompleted):
			task.Status = model.TaskStatusCompleted
			if task.CompletedAt == nil {
				now := time.Now()
				task.CompletedAt = &now
			}
		case string(model.TaskStatusOpen):
			task.Status = model.TaskStatusOpen
			task.CompletedAt = nil
		}
	}
	return task, nil
}

func (h *Handler) ensureTaskGroupExists(c echo.Context, userID string, groupID *string) error {
	if groupID == nil || *groupID == "" {
		return nil
	}
	var count int64
	if err := h.db.Model(&model.TaskGroup{}).Where("id = ? AND user_id = ?", *groupID, userID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "group_id does not exist")
	}
	return nil
}

func isValidTaskStatus(status string) bool {
	switch status {
	case string(model.TaskStatusOpen), string(model.TaskStatusCompleted):
		return true
	default:
		return false
	}
}

func isValidImportance(importance int) bool {
	return importance >= 1 && importance <= 3
}

func normalizeGroupID(c echo.Context, groupID **string) error {
	if *groupID == nil {
		return nil
	}
	value := strings.TrimSpace(**groupID)
	if value == "" {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must not be empty")
	}
	if !isUUIDLike(value) {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must be UUID")
	}
	*groupID = &value
	return nil
}

func normalizeLocationName(c echo.Context, locationName **string) error {
	if *locationName == nil {
		return nil
	}
	value := strings.TrimSpace(**locationName)
	if value == "" {
		*locationName = nil
		return nil
	}
	if len([]rune(value)) > 255 {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "location_name must be 255 characters or fewer")
	}
	*locationName = &value
	return nil
}

func normalizeOptionalTaskTime(c echo.Context, value **string, field string) error {
	if *value == nil {
		return nil
	}
	normalized := strings.TrimSpace(**value)
	if normalized == "" {
		return errorResponse(c, http.StatusBadRequest, "validation_error", field+" must not be empty")
	}
	if _, err := time.Parse(time.RFC3339, normalized); err != nil {
		return errorResponse(c, http.StatusBadRequest, "validation_error", field+" must be RFC3339")
	}
	*value = &normalized
	return nil
}

func parseOptionalTaskTime(c echo.Context, value *string, field string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, *value)
	if err != nil {
		return nil, errorResponse(c, http.StatusBadRequest, "validation_error", field+" must be RFC3339")
	}
	return &parsed, nil
}

func isUUIDLike(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, char := range value {
		switch i {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			if !isHex(char) {
				return false
			}
		}
	}
	return true
}

func isHex(char rune) bool {
	return ('0' <= char && char <= '9') ||
		('a' <= char && char <= 'f') ||
		('A' <= char && char <= 'F')
}

package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"nexttask/backend/internal/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type createScheduleRequest struct {
	GroupID      string  `json:"group_id"`
	Title        string  `json:"title"`
	LocationName *string `json:"location_name"`
	StartTime    string  `json:"start_time"`
	EndTime      string  `json:"end_time"`
}

type updateScheduleRequest struct {
	GroupID         *string `json:"group_id"`
	Title           *string `json:"title"`
	LocationName    *string `json:"location_name"`
	StartTime       *string `json:"start_time"`
	EndTime         *string `json:"end_time"`
	locationNameSet bool
}

func (h *Handler) ListSchedules(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}

	query := h.db.Preload("Group").Where("user_id = ?", userID).Order("start_time asc")
	if groupID := strings.TrimSpace(c.QueryParam("group_id")); groupID != "" {
		if !isUUIDLike(groupID) {
			return errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must be UUID")
		}
		query = query.Where("group_id = ?", groupID)
	}

	var schedules []model.Schedule
	if err := query.Find(&schedules).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, schedules)
}

func (h *Handler) CreateSchedule(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	req, err := bindCreateScheduleRequest(c)
	if err != nil {
		return err
	}
	if err := h.ensureScheduleGroupExists(c, userID, req.GroupID); err != nil {
		return err
	}
	startTime, endTime, err := parseScheduleTimes(c, req.StartTime, req.EndTime)
	if err != nil {
		return err
	}

	id, err := newID()
	if err != nil {
		return err
	}
	schedule := model.Schedule{
		ID:           id,
		UserID:       userID,
		GroupID:      req.GroupID,
		Title:        req.Title,
		LocationName: req.LocationName,
		StartTime:    startTime,
		EndTime:      endTime,
	}
	if err := h.db.Create(&schedule).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, schedule)
}

func (h *Handler) UpdateSchedule(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	req, err := bindUpdateScheduleRequest(c)
	if err != nil {
		return err
	}

	var schedule model.Schedule
	if err := h.db.First(&schedule, "id = ? AND user_id = ?", c.Param("id"), userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "not_found", "schedule not found")
		}
		return err
	}

	if req.GroupID != nil {
		if err := h.ensureScheduleGroupExists(c, userID, *req.GroupID); err != nil {
			return err
		}
		schedule.GroupID = *req.GroupID
	}
	if req.Title != nil {
		schedule.Title = *req.Title
	}
	if req.locationNameSet {
		schedule.LocationName = req.LocationName
	}
	if req.StartTime != nil {
		startTime, err := parseScheduleTime(c, *req.StartTime, "start_time")
		if err != nil {
			return err
		}
		schedule.StartTime = startTime
	}
	if req.EndTime != nil {
		endTime, err := parseScheduleTime(c, *req.EndTime, "end_time")
		if err != nil {
			return err
		}
		schedule.EndTime = endTime
	}
	if !schedule.EndTime.After(schedule.StartTime) {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "end_time must be after start_time")
	}

	if err := h.db.Save(&schedule).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, schedule)
}

func (h *Handler) DeleteSchedule(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	result := h.db.Delete(&model.Schedule{}, "id = ? AND user_id = ?", c.Param("id"), userID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errorResponse(c, http.StatusNotFound, "not_found", "schedule not found")
	}
	return c.NoContent(http.StatusNoContent)
}

func bindCreateScheduleRequest(c echo.Context) (createScheduleRequest, error) {
	var req createScheduleRequest
	if err := c.Bind(&req); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	req.GroupID = strings.TrimSpace(req.GroupID)
	req.Title = strings.TrimSpace(req.Title)
	req.StartTime = strings.TrimSpace(req.StartTime)
	req.EndTime = strings.TrimSpace(req.EndTime)
	if err := normalizeLocationName(c, &req.LocationName); err != nil {
		return req, err
	}
	if req.GroupID == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "group_id is required")
	}
	if !isUUIDLike(req.GroupID) {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must be UUID")
	}
	if req.Title == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "title is required")
	}
	if req.StartTime == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "start_time is required")
	}
	if req.EndTime == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "end_time is required")
	}
	return req, nil
}

func bindUpdateScheduleRequest(c echo.Context) (updateScheduleRequest, error) {
	var req updateScheduleRequest
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
	if req.GroupID != nil {
		groupID := strings.TrimSpace(*req.GroupID)
		if groupID == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must not be empty")
		}
		if !isUUIDLike(groupID) {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "group_id must be UUID")
		}
		req.GroupID = &groupID
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "title must not be empty")
		}
		req.Title = &title
	}
	if err := normalizeLocationName(c, &req.LocationName); err != nil {
		return req, err
	}
	if req.StartTime != nil {
		startTime := strings.TrimSpace(*req.StartTime)
		if startTime == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "start_time must not be empty")
		}
		req.StartTime = &startTime
	}
	if req.EndTime != nil {
		endTime := strings.TrimSpace(*req.EndTime)
		if endTime == "" {
			return req, errorResponse(c, http.StatusBadRequest, "validation_error", "end_time must not be empty")
		}
		req.EndTime = &endTime
	}
	return req, nil
}

func parseScheduleTimes(c echo.Context, start string, end string) (time.Time, time.Time, error) {
	startTime, err := parseScheduleTime(c, start, "start_time")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	endTime, err := parseScheduleTime(c, end, "end_time")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if !endTime.After(startTime) {
		return time.Time{}, time.Time{}, errorResponse(c, http.StatusBadRequest, "validation_error", "end_time must be after start_time")
	}
	return startTime, endTime, nil
}

func parseScheduleTime(c echo.Context, value string, field string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, errorResponse(c, http.StatusBadRequest, "validation_error", field+" must be RFC3339")
	}
	return parsed, nil
}

func (h *Handler) ensureScheduleGroupExists(c echo.Context, userID string, groupID string) error {
	var count int64
	if err := h.db.Model(&model.TaskGroup{}).Where("id = ? AND user_id = ?", groupID, userID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "group_id does not exist")
	}
	return nil
}

package handler

import (
	"net/http"
	"time"

	"nexttask/backend/internal/model"
	"nexttask/backend/internal/priority"

	"github.com/labstack/echo/v4"
)

type taskRequest struct {
	GroupID          *string `json:"group_id"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	Deadline         string  `json:"deadline"`
	EstimatedMinutes int     `json:"estimated_minutes"`
	Weight           int     `json:"weight"`
	Status           string  `json:"status"`
}

func (h *Handler) ListTasks(c echo.Context) error {
	var tasks []model.Task
	query := h.db.Preload("Group").Order("priority_score desc").Order("deadline asc")
	if groupID := c.QueryParam("group_id"); groupID != "" {
		query = query.Where("group_id = ?", groupID)
	}
	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&tasks).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, tasks)
}

func (h *Handler) CreateTask(c echo.Context) error {
	req, err := bindTaskRequest(c)
	if err != nil {
		return err
	}
	task, err := h.taskFromRequest(req, model.Task{})
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
	req, err := bindTaskRequest(c)
	if err != nil {
		return err
	}
	var task model.Task
	if err := h.db.First(&task, "id = ?", c.Param("id")).Error; err != nil {
		return err
	}
	task, err = h.taskFromRequest(req, task)
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
	if err := h.db.Delete(&model.Task{}, "id = ?", c.Param("id")).Error; err != nil {
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func bindTaskRequest(c echo.Context) (taskRequest, error) {
	var req taskRequest
	if err := c.Bind(&req); err != nil {
		return req, echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}
	if req.Title == "" {
		return req, echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}
	if req.Deadline == "" {
		return req, echo.NewHTTPError(http.StatusBadRequest, "deadline is required")
	}
	if req.EstimatedMinutes <= 0 {
		return req, echo.NewHTTPError(http.StatusBadRequest, "estimated_minutes must be greater than 0")
	}
	if req.Weight <= 0 {
		req.Weight = 1
	}
	return req, nil
}

func (h *Handler) taskFromRequest(req taskRequest, task model.Task) (model.Task, error) {
	deadline, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		return task, echo.NewHTTPError(http.StatusBadRequest, "deadline must be RFC3339")
	}
	task.GroupID = req.GroupID
	task.Title = req.Title
	task.Description = req.Description
	task.Deadline = deadline
	task.EstimatedMinutes = req.EstimatedMinutes
	task.Weight = req.Weight
	if req.Status == string(model.TaskStatusCompleted) && task.CompletedAt == nil {
		now := time.Now()
		task.Status = model.TaskStatusCompleted
		task.CompletedAt = &now
	} else if req.Status == string(model.TaskStatusOpen) {
		task.Status = model.TaskStatusOpen
		task.CompletedAt = nil
	}
	return task, nil
}

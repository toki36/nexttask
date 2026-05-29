package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"nexttask/backend/internal/model"

	"github.com/labstack/echo/v4"
)

func (h *Handler) ExportICS(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return err
	}
	var tasks []model.Task
	if err := h.db.Where("user_id = ? AND status = ?", userID, model.TaskStatusOpen).Order("deadline asc").Find(&tasks).Error; err != nil {
		return err
	}

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//NextTask//NextTask Backend//JA\r\n")
	now := time.Now().UTC().Format("20060102T150405Z")
	for _, task := range tasks {
		deadline := task.Deadline.UTC().Format("20060102T150405Z")
		b.WriteString("BEGIN:VEVENT\r\n")
		b.WriteString(fmt.Sprintf("UID:%s@nexttask\r\n", task.ID))
		b.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", now))
		b.WriteString(fmt.Sprintf("DTSTART:%s\r\n", deadline))
		b.WriteString(fmt.Sprintf("DTEND:%s\r\n", task.Deadline.Add(30*time.Minute).UTC().Format("20060102T150405Z")))
		b.WriteString(fmt.Sprintf("SUMMARY:%s\r\n", escapeICS(task.Title)))
		if task.Description != "" {
			b.WriteString(fmt.Sprintf("DESCRIPTION:%s\r\n", escapeICS(task.Description)))
		}
		b.WriteString("END:VEVENT\r\n")
	}
	b.WriteString("END:VCALENDAR\r\n")

	return c.Blob(http.StatusOK, "text/calendar; charset=utf-8", []byte(b.String()))
}

func escapeICS(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "\n", "\\n")
	value = strings.ReplaceAll(value, ",", "\\,")
	value = strings.ReplaceAll(value, ";", "\\;")
	return value
}

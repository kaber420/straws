package main

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

func extractIdentity(auth string) (tabId int, winId int, chaosMode string) {
	tabId = -1
	winId = -1
	chaosMode = ""
	if !strings.HasPrefix(auth, "Basic ") {
		return tabId, winId, chaosMode
	}
	payload, err := base64.StdEncoding.DecodeString(auth[6:])
	if err != nil {
		return tabId, winId, chaosMode
	}
	fullAuth := string(payload)
	lastColon := strings.LastIndex(fullAuth, ":")
	if lastColon == -1 {
		return tabId, winId, chaosMode
	}
	identity := fullAuth[:lastColon]
	tags := strings.Split(identity, "|")
	for _, tag := range tags {
		if strings.HasPrefix(tag, "win:") || strings.HasPrefix(tag, "win=") {
			// Extract after ":" or "="
			sepIdx := strings.IndexAny(tag, ":=")
			if sepIdx != -1 {
				val, _ := strconv.Atoi(tag[sepIdx+1:])
				winId = val
			}
		} else if strings.HasPrefix(tag, "tab:") || strings.HasPrefix(tag, "tab=") {
			sepIdx := strings.IndexAny(tag, ":=")
			if sepIdx != -1 {
				val, _ := strconv.Atoi(tag[sepIdx+1:])
				tabId = val
			}
		} else if strings.HasPrefix(tag, "chaos:") || strings.HasPrefix(tag, "chaos=") {
			sepIdx := strings.IndexAny(tag, ":=")
			if sepIdx != -1 {
				chaosMode = tag[sepIdx+1:]
			}
		}
	}
	return tabId, winId, chaosMode
}

func main() {
	tests := []struct{
		name string
		val string
	}{
		{"Modern Separator (=)", "win=1|tab=123|chaos=latency:straws"},
		{"Legacy Separator (:)", "win:1|tab:123|chaos:latency:straws"},
		{"Mixed/Container", "cont=Work:Main|tab=12|chaos=drop:straws"},
		{"System (No Metadata)", "type:system:straws"},
	}

	for _, tt := range tests {
		auth := "Basic " + base64.StdEncoding.EncodeToString([]byte(tt.val))
		tab, win, chaos := extractIdentity(auth)
		fmt.Printf("[%s] -> Tab=%d, Win=%d, Chaos=%s\n", tt.name, tab, win, chaos)
	}
}

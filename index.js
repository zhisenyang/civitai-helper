// ==UserScript==
// @name         civitai helper
// @namespace    https://github.com/zhisenyang/civitai-helper
// @version      0.0.3
// @description  当前版本只有快捷下载功能，会有些 bug，后续将更新更多功能。
// @author       Johnsen Young
// @match        https://civitai.com/*
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=civitai.com
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
  "use strict";

  // 下载记录管理
  const DOWNLOAD_RECORDS_KEY = "civitai_download_records";

  // 获取下载记录
  function getDownloadRecords() {
    const stored = GM_getValue(DOWNLOAD_RECORDS_KEY, "");
    if (typeof stored === "string") {
      return stored
        .split("\n")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    }

    // 兼容旧版本 JSON 结构，读取后转存为新格式
    if (stored && typeof stored === "object") {
      const legacyNames = Object.values(stored)
        .map((item) => item && item.fileName)
        .filter((name) => typeof name === "string" && name.length > 0);
      setDownloadRecords(legacyNames);
      return legacyNames;
    }

    return [];
  }

  // 以换行形式保存下载记录
  function setDownloadRecords(records) {
    const uniqueNames = Array.from(
      new Set(
        records
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter((name) => name.length > 0)
      )
    );
    GM_setValue(DOWNLOAD_RECORDS_KEY, uniqueNames.join("\n"));
    return uniqueNames;
  }

  // 保存下载记录
  function saveDownloadRecord(fileName) {
    const records = getDownloadRecords();
    records.push(fileName);
    setDownloadRecords(records);
  }

  // 判断文件名是否已下载
  function isFileDownloaded(fileName) {
    return getDownloadRecords().includes(fileName);
  }

  // 样式配置对象，便于统一管理和修改
  const BUTTON_STYLES = {
    position: "absolute",
    top: "40px",
    left: "10px",
    width: "40px",
    height: "40px",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "50%",
    zIndex: "10",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease, background-color 0.2s ease",
  };

  // 全局下载按钮样式
  const GLOBAL_BUTTON_STYLES = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "50px",
    height: "50px",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "50%",
    zIndex: "1000",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease, background-color 0.2s ease",
    boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
  };

  const DOWNLOAD_BUTTON_ICON =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

  const DOWNLOAD_LOADING_ICON =
    '<svg class="civitai-helper-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle><path d="M12 3a9 9 0 0 1 9 9" stroke-opacity="0.9"></path></svg>';

  function ensureSpinnerStyle() {
    if (document.getElementById("civitai-helper-spinner-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "civitai-helper-spinner-style";
    style.textContent =
      "@keyframes civitai-helper-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}" +
      ".civitai-helper-spinner{animation:civitai-helper-spin 1s linear infinite;transform-origin:12px 12px;opacity:0.9;}";
    document.head.appendChild(style);
  }

  function setDownloadButtonLoading(button, isLoading) {
    if (isLoading) {
      ensureSpinnerStyle();
      button.dataset.loading = "true";
      button.style.pointerEvents = "none";
      button.innerHTML = DOWNLOAD_LOADING_ICON;
    } else {
      button.dataset.loading = "false";
      button.style.pointerEvents = "auto";
      button.innerHTML = DOWNLOAD_BUTTON_ICON;
    }
  }

  function appendDownloadedMark(link, options = {}) {
    if (link.querySelector(".downloaded-mark")) {
      return;
    }
    const mark = document.createElement("div");
    mark.className = "downloaded-mark";
    mark.style.position = "absolute";
    mark.style.top = "10px";
    mark.style.right = options.right || "10px";
    mark.style.backgroundColor = "rgba(0, 128, 0, 0.7)";
    mark.style.color = "white";
    mark.style.padding = "2px 6px";
    mark.style.borderRadius = "10px";
    mark.style.fontSize = "12px";
    mark.style.zIndex = "10";
    mark.textContent = "已下载";
    link.appendChild(mark);
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // 保持在32位整数范围内
    }
    return Math.abs(hash);
  }

  function buildDownloadInfo(url) {
    const urlParts = url.split("/");
    // 格式为：transcode=true,width=450
    urlParts.splice(urlParts.length - 2, 1, "transcode=true,original=true");
    let fileName = urlParts[urlParts.length - 1] || "civitai-video.mp4";
    fileName = fileName.split("?")[0] || "civitai-video.mp4";

    // 如果文件名不是以.mp4结尾，添加时间戳和扩展名
    if (!fileName.endsWith(".mp4")) {
      const baseName = fileName
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "");
      const normalizedBase = baseName.length > 0 ? baseName : "civitai-video";
      fileName = `${normalizedBase}-${hashString(url)}.mp4`;
    }

    const downloadUrl = urlParts.join("/");

    return {
      downloadUrl,
      fileName,
    };
  }

  // 下载视频文件的函数
  function downloadMP4(url, callbacks = {}) {
    const { downloadUrl, fileName } = buildDownloadInfo(url);
    const { onSkip, onStart, onSuccess, onProgress, onTimeout, onError } =
      callbacks;

    // 检查是否已经下载过
    if (isFileDownloaded(fileName)) {
      console.log("该视频已经下载过");
      if (typeof onSkip === "function") {
        onSkip(fileName);
      }
      return "already_downloaded";
    }

    console.log("downloadUrl", downloadUrl);
    if (typeof onStart === "function") {
      onStart(fileName);
    }
    GM_download({
      url: downloadUrl,
      name: fileName,
      onload: function () {
        console.log("下载完成", fileName);
        // 保存下载记录
        saveDownloadRecord(fileName);
        if (typeof onSuccess === "function") {
          onSuccess(fileName);
        }
      },
      // onprogress: function (res) {
      //   console.log("onprogress:", res);
      //   if (typeof onProgress === "function") {
      //     onProgress(fileName, res);
      //   }
      // },
      ontimeout: function (res) {
        console.log("ontimeout:", res);
        if (typeof onTimeout === "function") {
          onTimeout(fileName, res);
        } else if (typeof onError === "function") {
          onError(fileName, res);
        }
      },
      onerror: function (e) {
        console.log("下载失败:", e.error);
        if (typeof onError === "function") {
          onError(fileName, e);
        }
      },
    });

    return true;
  }

  // 创建下载按钮并添加事件监听器的函数
  function createDownloadButton(link) {
    // 检查是否已经添加了下载按钮
    if (link.querySelector(".download-button")) {
      return; // 如果已存在下载按钮，则不重复创建
    }

    // 检查视频是否已下载，添加标记
    const videoElement = link.querySelector("video");
    if (videoElement) {
      const mp4Source = videoElement.querySelector('source[type="video/mp4"]');
      if (mp4Source && mp4Source.src) {
        const { fileName } = buildDownloadInfo(mp4Source.src);
        if (isFileDownloaded(fileName)) {
          appendDownloadedMark(link, { right: "40px" });
        }
      }
    }

    // 创建下载按钮元素
    const downloadBtn = document.createElement("div");
    downloadBtn.className = "download-button";

    // 应用样式
    Object.assign(downloadBtn.style, BUTTON_STYLES);
    downloadBtn.style.display = "none";

    // 添加下载图标
    setDownloadButtonLoading(downloadBtn, false);

    // 确保link元素有相对定位，这样下载按钮可以正确定位
    if (getComputedStyle(link).position === "static") {
      link.style.position = "relative";
    }

    // 添加鼠标悬停事件
    link.addEventListener("mouseenter", function () {
      downloadBtn.style.display = "flex";
      videoElement.play();
    });

    link.addEventListener("mouseleave", function () {
      if (downloadBtn.dataset.loading === "true") {
        return;
      }
      downloadBtn.style.display = "none";
    });

    // 添加按钮悬停效果
    downloadBtn.addEventListener("mouseenter", function () {
      this.style.transform = "scale(1.1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    });

    downloadBtn.addEventListener("mouseleave", function () {
      this.style.transform = "scale(1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    });

    // 添加下载按钮点击事件
    downloadBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (downloadBtn.dataset.loading === "true") {
        return;
      }

      // 获取视频元素中的MP4源文件URL
      const videoElement = link.querySelector("video");
      if (videoElement) {
        // 查找MP4源
        const mp4Source = videoElement.querySelector(
          'source[type="video/mp4"]'
        );
        if (mp4Source && mp4Source.src) {
          const baseColor = downloadBtn.style.backgroundColor;
          const hideIfNotHover = () => {
            if (!link.matches(":hover")) {
              downloadBtn.style.display = "none";
            }
          };
          let flashTimer = null;
          const flashColor = (color, duration = 500, after) => {
            if (flashTimer) {
              clearTimeout(flashTimer);
            }
            downloadBtn.style.backgroundColor = color;
            flashTimer = setTimeout(() => {
              downloadBtn.style.backgroundColor = baseColor;
              flashTimer = null;
              if (typeof after === "function") {
                after();
              }
            }, duration);
          };

          // 下载MP4文件
          const result = downloadMP4(mp4Source.src, {
            onStart: () => {
              setDownloadButtonLoading(downloadBtn, true);
              downloadBtn.style.display = "flex";
              downloadBtn.style.backgroundColor = "rgba(52, 152, 219, 0.8)";
            },
            onSuccess: () => {
              setDownloadButtonLoading(downloadBtn, false);
              appendDownloadedMark(link);
              flashColor("rgba(0, 128, 0, 0.7)", 500, hideIfNotHover);
            },
            onSkip: () => {
              setDownloadButtonLoading(downloadBtn, false);
              flashColor("rgba(255, 165, 0, 0.7)", 500, hideIfNotHover);
              alert("该视频已经下载过");
            },
            onError: () => {
              setDownloadButtonLoading(downloadBtn, false);
              flashColor("rgba(255, 99, 71, 0.8)", 800, hideIfNotHover);
              alert("下载失败，请稍后重试");
            },
            onTimeout: () => {
              setDownloadButtonLoading(downloadBtn, false);
              flashColor("rgba(255, 99, 71, 0.8)", 800, hideIfNotHover);
              alert("下载超时，请稍后重试");
            },
          });

          if (result === "already_downloaded") {
            return;
          }

          if (result !== true) {
            setDownloadButtonLoading(downloadBtn, false);
            downloadBtn.style.backgroundColor = baseColor;
            hideIfNotHover();
          }
        }
      }
    });

    // 将下载按钮添加到链接元素中
    link.appendChild(downloadBtn);
  }

  /**
   * 处理页面上的所有目标元素
   * 查找所有符合条件的卡片链接并添加下载按钮
   */
  function processCardLinks() {
    try {
      // 查找所有class为EdgeVideo_iosScroll___eG2B 的元素
      const cardLinks = document.querySelectorAll(
        ".EdgeVideo_iosScroll___eG2B "
      );

      // 如果找到了目标元素，就为每个元素添加下载按钮
      if (cardLinks.length > 0) {
        console.log(`找到 ${cardLinks.length} 个视频卡片，添加下载按钮...`);
        cardLinks.forEach(createDownloadButton);
      }
    } catch (error) {
      console.error("处理卡片链接时出错:", error);
    }
  }

  /**
   * 防抖函数 - 用于优化频繁触发的事件
   * @param {Function} func - 要执行的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} - 防抖处理后的函数
   */
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // 创建下载记录管理界面
  function createDownloadRecordsUI() {
    // 检查是否已经添加了下载记录界面
    const existing = document.querySelector(".download-records-ui");
    if (existing) {
      return existing;
    }

    // 创建下载记录界面容器
    const recordsUI = document.createElement("div");
    recordsUI.className = "download-records-ui";
    recordsUI.style.position = "fixed";
    recordsUI.style.top = "50%";
    recordsUI.style.left = "50%";
    recordsUI.style.transform = "translate(-50%, -50%)";
    recordsUI.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    recordsUI.style.color = "white";
    recordsUI.style.padding = "20px";
    recordsUI.style.borderRadius = "10px";
    recordsUI.style.zIndex = "2000";
    recordsUI.style.maxWidth = "80%";
    recordsUI.style.maxHeight = "80%";
    recordsUI.style.overflow = "auto";
    recordsUI.style.display = "none";
    recordsUI.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";

    // 添加标题
    const title = document.createElement("h2");
    title.textContent = "下载记录";
    title.style.marginTop = "0";
    title.style.marginBottom = "15px";
    recordsUI.appendChild(title);

    // 添加关闭按钮
    const closeBtn = document.createElement("div");
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "10px";
    closeBtn.style.right = "10px";
    closeBtn.style.cursor = "pointer";
    closeBtn.innerHTML = "&times;";
    closeBtn.style.fontSize = "24px";
    closeBtn.addEventListener("click", function () {
      recordsUI.style.display = "none";
    });
    recordsUI.appendChild(closeBtn);

    const helperText = document.createElement("p");
    helperText.textContent =
      "每行一个文件名，空行会被忽略。编辑后点击保存即可更新记录。";
    helperText.style.marginTop = "0";
    helperText.style.color = "#ccc";
    recordsUI.appendChild(helperText);

    const textarea = document.createElement("textarea");
    textarea.style.width = "100%";
    textarea.style.minHeight = "240px";
    textarea.style.backgroundColor = "rgba(255,255,255,0.1)";
    textarea.style.color = "#fff";
    textarea.style.border = "1px solid rgba(255,255,255,0.2)";
    textarea.style.borderRadius = "6px";
    textarea.style.padding = "12px";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = "monospace";
    textarea.style.fontSize = "14px";
    recordsUI.appendChild(textarea);

    const metaBar = document.createElement("div");
    metaBar.style.display = "flex";
    metaBar.style.justifyContent = "space-between";
    metaBar.style.alignItems = "center";
    metaBar.style.marginTop = "10px";
    recordsUI.appendChild(metaBar);

    const countLabel = document.createElement("span");
    countLabel.style.color = "#aaa";
    metaBar.appendChild(countLabel);

    const statusLabel = document.createElement("span");
    statusLabel.style.color = "#4caf50";
    statusLabel.style.opacity = "0";
    statusLabel.style.transition = "opacity 0.3s ease";
    metaBar.appendChild(statusLabel);

    const actionBar = document.createElement("div");
    actionBar.style.display = "flex";
    actionBar.style.justifyContent = "flex-end";
    actionBar.style.gap = "10px";
    actionBar.style.marginTop = "15px";
    recordsUI.appendChild(actionBar);

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.padding = "8px 18px";
    saveBtn.style.backgroundColor = "#4caf50";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "5px";
    saveBtn.style.color = "white";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "14px";
    actionBar.appendChild(saveBtn);

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "恢复当前记录";
    refreshBtn.style.padding = "8px 18px";
    refreshBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    refreshBtn.style.border = "1px solid rgba(255,255,255,0.2)";
    refreshBtn.style.borderRadius = "5px";
    refreshBtn.style.color = "white";
    refreshBtn.style.cursor = "pointer";
    refreshBtn.style.fontSize = "14px";
    actionBar.appendChild(refreshBtn);

    function showStatus(text) {
      statusLabel.textContent = text;
      statusLabel.style.opacity = "1";
      setTimeout(() => {
        statusLabel.style.opacity = "0";
      }, 1600);
    }

    function refreshRecordsEditor() {
      const recordList = getDownloadRecords();
      textarea.value = recordList.join("\n");
      countLabel.textContent = `当前记录数：${recordList.length}`;
      statusLabel.style.opacity = "0";
    }

    saveBtn.addEventListener("click", function () {
      const sanitized = textarea.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const unique = setDownloadRecords(sanitized);
      textarea.value = unique.join("\n");
      countLabel.textContent = `当前记录数：${unique.length}`;
      showStatus("保存成功");
      processCardLinks();
    });

    refreshBtn.addEventListener("click", function () {
      refreshRecordsEditor();
      showStatus("已恢复");
    });

    refreshRecordsEditor();

    // 暴露刷新方法，方便外部调用
    recordsUI.refreshRecordsEditor = refreshRecordsEditor;

    // 将下载记录界面添加到页面
    document.body.appendChild(recordsUI);

    return recordsUI;
  }

  // 创建全局下载按钮
  function createGlobalDownloadButton() {
    // 检查是否已经添加了全局下载按钮
    if (document.querySelector(".global-download-button")) {
      return; // 如果已存在全局下载按钮，则不重复创建
    }

    // 创建全局下载按钮元素
    const globalDownloadBtn = document.createElement("div");
    globalDownloadBtn.className = "global-download-button";

    // 应用样式
    Object.assign(globalDownloadBtn.style, GLOBAL_BUTTON_STYLES);

    // 添加下载图标
    globalDownloadBtn.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
      '<span class="download-count" style="position: absolute; top: -5px; right: -5px; background-color: red; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; display: flex; align-items: center; justify-content: center;">0</span>';

    // 添加按钮悬停效果
    globalDownloadBtn.addEventListener("mouseenter", function () {
      this.style.transform = "scale(1.1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    });

    globalDownloadBtn.addEventListener("mouseleave", function () {
      this.style.transform = "scale(1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    });

    // 添加全局下载按钮点击事件
    globalDownloadBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      downloadAllVideos();
    });

    // 创建下载记录按钮
    const recordsBtn = document.createElement("div");
    recordsBtn.className = "records-button";
    Object.assign(recordsBtn.style, GLOBAL_BUTTON_STYLES);
    recordsBtn.style.bottom = "80px"; // 位置在全局下载按钮上方

    // 添加记录图标
    recordsBtn.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';

    // 添加按钮悬停效果
    recordsBtn.addEventListener("mouseenter", function () {
      this.style.transform = "scale(1.1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    });

    recordsBtn.addEventListener("mouseleave", function () {
      this.style.transform = "scale(1)";
      this.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    });

    // 添加记录按钮点击事件
    recordsBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      // 显示下载记录界面
      const recordsUI = createDownloadRecordsUI();
      if (typeof recordsUI.refreshRecordsEditor === "function") {
        recordsUI.refreshRecordsEditor();
      }
      recordsUI.style.display = "block";
    });

    // 将记录按钮添加到页面
    document.body.appendChild(recordsBtn);

    // 将全局下载按钮添加到页面
    document.body.appendChild(globalDownloadBtn);
    updateGlobalButtonCount();
  }

  // 更新全局下载按钮上的视频计数
  function updateGlobalButtonCount() {
    const countElement = document.querySelector(
      ".global-download-button .download-count"
    );
    if (countElement) {
      const videoCount = document.querySelectorAll(
        ".EdgeVideo_iosScroll___eG2B  video"
      ).length;
      countElement.textContent = videoCount;

      // 如果没有视频，隐藏按钮
      const globalButton = document.querySelector(".global-download-button");
      if (globalButton) {
        globalButton.style.display = videoCount > 0 ? "flex" : "none";
      }
    }
  }

  // 下载所有视频
  function downloadAllVideos() {
    const cardLinks = document.querySelectorAll(".EdgeVideo_iosScroll___eG2B ");
    const downloadTasks = [];

    cardLinks.forEach((link) => {
      const videoElement = link.querySelector("video");
      if (!videoElement) {
        return;
      }
      const mp4Source = videoElement.querySelector('source[type="video/mp4"]');
      if (!mp4Source || !mp4Source.src) {
        return;
      }
      const { fileName } = buildDownloadInfo(mp4Source.src);
      downloadTasks.push({
        link,
        url: mp4Source.src,
        fileName,
      });
    });

    if (downloadTasks.length === 0) {
      alert("当前页面没有找到可下载的视频");
      return;
    }

    const totalVideos = downloadTasks.length;
    let completedCount = 0;
    let scheduledDownloads = 0;
    let startedCount = 0;
    let hasError = false;

    const progressElement = document.createElement("div");
    progressElement.style.position = "fixed";
    progressElement.style.bottom = "80px";
    progressElement.style.right = "20px";
    progressElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    progressElement.style.color = "white";
    progressElement.style.padding = "10px";
    progressElement.style.borderRadius = "5px";
    progressElement.style.zIndex = "1000";
    progressElement.textContent = `准备处理 0/${totalVideos} 个视频...`;
    document.body.appendChild(progressElement);

    const globalButton = document.querySelector(".global-download-button");
    if (globalButton) {
      globalButton.style.backgroundColor = "rgba(255, 165, 0, 0.7)";
    }

    function updateProgress(prefix) {
      progressElement.textContent = `${prefix} ${completedCount}/${totalVideos} 个视频...`;
    }

    function finalize() {
      if (hasError) {
        progressElement.textContent = `全部 ${totalVideos} 个视频已处理，但存在失败，请稍后重试。`;
        if (globalButton) {
          globalButton.style.backgroundColor = "rgba(255, 99, 71, 0.7)";
        }
      } else {
        progressElement.textContent = `已完成全部 ${totalVideos} 个视频下载！`;
        if (globalButton) {
          globalButton.style.backgroundColor = "rgba(0, 128, 0, 0.7)";
        }
      }

      setTimeout(() => {
        if (globalButton) {
          globalButton.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        }
        setTimeout(() => {
          if (progressElement.parentNode) {
            progressElement.parentNode.removeChild(progressElement);
          }
        }, 3000);
      }, 1000);

      updateGlobalButtonCount();
      processCardLinks();
    }

    function handleCompletion(prefix) {
      completedCount += 1;
      updateProgress(prefix);
      if (completedCount === totalVideos) {
        finalize();
      }
    }

    const delayPerDownload = 400;

    downloadTasks.forEach(({ link, url, fileName }) => {
      if (isFileDownloaded(fileName)) {
        handleCompletion("跳过已下载视频");
        return;
      }

      const delay = scheduledDownloads * delayPerDownload;
      scheduledDownloads += 1;

      setTimeout(() => {
        downloadMP4(url, {
          onStart: () => {
            startedCount += 1;
            progressElement.textContent = `正在下载 ${startedCount}/${totalVideos} 个视频...`;
          },
          onSuccess: () => {
            appendDownloadedMark(link);
            handleCompletion("下载完成");
          },
          onSkip: () => {
            handleCompletion("跳过已下载视频");
          },
          onError: () => {
            hasError = true;
            handleCompletion("下载失败");
          },
          onTimeout: () => {
            hasError = true;
            handleCompletion("下载超时");
          },
        });
      }, delay);
    });
  }

  // 等待页面加载完成
  window.addEventListener("load", function () {
    console.log("Civitai视频下载脚本已加载");

    // 创建一个观察器来监视DOM变化，因为civitai可能使用动态加载
    // 使用防抖函数优化性能，避免短时间内多次触发
    const debouncedProcess = debounce(processCardLinks, 300);
    const observer = new MutationObserver(debouncedProcess);

    // 配置观察器
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 立即检查一次当前页面
    processCardLinks();

    // 创建全局下载按钮和下载记录界面
    createGlobalDownloadButton();
    createDownloadRecordsUI();

    // 添加页面滚动事件监听，处理懒加载内容
    window.addEventListener(
      "scroll",
      debounce(() => {
        processCardLinks();
        updateGlobalButtonCount();
      }, 500)
    );
  });
})();

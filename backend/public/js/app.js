let mode = "login";
let me = null;
let selectedUser = null;
let socket = null;

/* =========================================================
   DOM
========================================================= */

const authView = document.getElementById("authView");
const chatView = document.getElementById("chatView");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const authForm = document.getElementById("authForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const authMsg = document.getElementById("authMsg");

const usersList = document.getElementById("usersList");

const messagesBox = document.getElementById("messages");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const chatTitle = document.getElementById("chatTitle");
const meName = document.getElementById("meName");

const avatarText = document.getElementById("avatarText");

const logoutBtn = document.getElementById("logoutBtn");


/* =========================================================
   HELPER
========================================================= */

function setAuthMessage(message = "", type = "error") {
  authMsg.textContent = message;

  if (type === "success") {
    authMsg.style.color = "#16a34a";
  } else {
    authMsg.style.color = "#dc2626";
  }
}


function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}


function scrollMessagesToBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}


function showEmptyChat(
  title = "Chưa chọn cuộc trò chuyện",
  description = "Chọn một người dùng ở bên trái để bắt đầu nhắn tin."
) {
  messagesBox.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "empty-chat";

  const icon = document.createElement("div");
  icon.className = "empty-chat-icon";
  icon.textContent = "💬";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const text = document.createElement("p");
  text.textContent = description;

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(text);

  messagesBox.appendChild(wrapper);
}


function setComposerEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;

  if (!enabled) {
    messageInput.value = "";
  }
}


/* =========================================================
   LOGIN / REGISTER TAB
========================================================= */

function setMode(next) {
  mode = next;

  const isLogin = mode === "login";

  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);

  submitBtn.textContent = isLogin
    ? "Đăng nhập"
    : "Đăng ký";

  passwordInput.setAttribute(
    "autocomplete",
    isLogin
      ? "current-password"
      : "new-password"
  );

  setAuthMessage("");
}


loginTab.addEventListener("click", () => {
  setMode("login");
});


registerTab.addEventListener("click", () => {
  setMode("register");
});


/* =========================================================
   LOGIN / REGISTER
========================================================= */

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setAuthMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
    return;
  }

  if (mode === "register" && password.length < 6) {
    setAuthMessage("Mật khẩu phải có ít nhất 6 ký tự.");
    return;
  }

  const originalButtonText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = "Đang xử lý...";

  try {
    const url =
      mode === "login"
        ? "/api/login"
        : "/api/register";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setAuthMessage(
        data.error || "Không thể xử lý yêu cầu."
      );
      return;
    }

    if (mode === "register") {
      setAuthMessage(
        "Đăng ký thành công. Hãy đăng nhập.",
        "success"
      );

      setMode("login");

      usernameInput.value = username;
      passwordInput.value = "";
      passwordInput.focus();

      return;
    }

    passwordInput.value = "";

    await initChat();

  } catch (error) {
    console.error("Auth error:", error);

    setAuthMessage(
      "Không thể kết nối tới máy chủ."
    );

  } finally {
    submitBtn.disabled = false;

    submitBtn.textContent =
      mode === "login"
        ? "Đăng nhập"
        : "Đăng ký";

    if (!submitBtn.textContent) {
      submitBtn.textContent = originalButtonText;
    }
  }
});


/* =========================================================
   KHỞI TẠO CHAT
========================================================= */

async function initChat() {
  try {
    const response = await fetch("/api/me");

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    me = data.user;

    if (!me) {
      return;
    }

    authView.classList.add("hidden");
    chatView.classList.remove("hidden");

    meName.textContent = me.username;

    if (avatarText) {
      avatarText.textContent =
        me.username
          ?.charAt(0)
          ?.toUpperCase() || "U";
    }

    selectedUser = null;

    chatTitle.textContent =
      "Chọn một người để bắt đầu chat";

    setComposerEnabled(false);

    showEmptyChat();

    await loadUsers();

    connectSocket();

  } catch (error) {
    console.error(
      "Init chat error:",
      error
    );
  }
}


/* =========================================================
   SOCKET.IO
========================================================= */

function connectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io();

  socket.on("connect", () => {
    console.log(
      "Socket connected:",
      socket.id
    );
  });

  socket.on("disconnect", () => {
    console.log(
      "Socket disconnected"
    );
  });

  socket.on("chat:message", (msg) => {
    if (!selectedUser || !me) {
      return;
    }

    const senderId = Number(msg.sender_id);
    const receiverId = Number(msg.receiver_id);

    const myId = Number(me.id);
    const selectedId = Number(selectedUser.id);

    const involved =
      (
        senderId === myId &&
        receiverId === selectedId
      )
      ||
      (
        senderId === selectedId &&
        receiverId === myId
      );

    if (involved) {
      appendMessage(msg);
    }
  });
}


/* =========================================================
   LOAD USERS
========================================================= */

async function loadUsers() {
  usersList.innerHTML = "";

  try {
    const response = await fetch("/api/users");

    if (!response.ok) {
      throw new Error(
        "Không thể tải danh sách người dùng."
      );
    }

    const users = await response.json();

    if (!Array.isArray(users) || users.length === 0) {
      const empty = document.createElement("div");

      empty.className = "muted small";

      empty.style.padding = "12px";

      empty.textContent =
        "Chưa có người dùng khác.";

      usersList.appendChild(empty);

      return;
    }

    users.forEach((user) => {
      const item = document.createElement("button");

      item.type = "button";

      item.className = "user-item";

      item.dataset.userId = user.id;

      item.textContent = user.username;

      item.addEventListener("click", () => {
        selectUser(user, item);
      });

      usersList.appendChild(item);
    });

  } catch (error) {
    console.error(
      "Load users error:",
      error
    );

    const errorText =
      document.createElement("div");

    errorText.className = "muted small";

    errorText.style.padding = "12px";

    errorText.textContent =
      "Không thể tải danh sách người dùng.";

    usersList.appendChild(errorText);
  }
}


/* =========================================================
   CHỌN NGƯỜI CHAT
========================================================= */

async function selectUser(user, item) {
  selectedUser = user;

  document
    .querySelectorAll(".user-item")
    .forEach((element) => {
      element.classList.remove("active");
    });

  item.classList.add("active");

  chatTitle.textContent =
    `Chat với ${user.username}`;

  setComposerEnabled(true);

  messagesBox.innerHTML = "";

  const loading =
    document.createElement("div");

  loading.className = "empty-chat";

  loading.innerHTML = `
    <p>Đang tải lịch sử tin nhắn...</p>
  `;

  messagesBox.appendChild(loading);

  try {
    const response = await fetch(
      `/api/messages/${user.id}`
    );

    if (!response.ok) {
      throw new Error(
        "Không thể tải lịch sử tin nhắn."
      );
    }

    const messages =
      await response.json();

    messagesBox.innerHTML = "";

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      showEmptyChat(
        "Chưa có tin nhắn",
        `Hãy gửi tin nhắn đầu tiên cho ${user.username}.`
      );
    } else {
      messages.forEach((message) => {
        appendMessage(message, false);
      });

      scrollMessagesToBottom();
    }

    messageInput.focus();

  } catch (error) {
    console.error(
      "Load messages error:",
      error
    );

    showEmptyChat(
      "Không thể tải tin nhắn",
      "Vui lòng thử lại sau."
    );
  }
}


/* =========================================================
   HIỂN THỊ TIN NHẮN
========================================================= */

function appendMessage(
  msg,
  shouldScroll = true
) {
  const existingEmpty =
    messagesBox.querySelector(
      ".empty-chat"
    );

  if (existingEmpty) {
    messagesBox.innerHTML = "";
  }

  const isMine =
    Number(msg.sender_id) ===
    Number(me.id);

  const row =
    document.createElement("div");

  row.className =
    `message-row ${
      isMine
        ? "sent"
        : "received"
    }`;

  const bubble =
    document.createElement("div");

  bubble.className =
    "message-bubble";

  const content =
    document.createElement("div");

  content.className =
    "message-text";

  content.textContent =
    msg.content || "";

  const meta =
    document.createElement("div");

  meta.className =
    "message-meta";

  const senderName =
    isMine
      ? "Bạn"
      : (
          msg.sender_name ||
          selectedUser?.username ||
          "Người dùng"
        );

  meta.textContent =
    `${senderName} • ${formatDateTime(msg.created_at)}`;

  bubble.appendChild(content);

  bubble.appendChild(meta);

  row.appendChild(bubble);

  messagesBox.appendChild(row);

  if (shouldScroll) {
    scrollMessagesToBottom();
  }
}


/* =========================================================
   GỬI TIN NHẮN
========================================================= */

messageForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const content =
      messageInput.value.trim();

    if (
      !selectedUser ||
      !content ||
      !socket ||
      !socket.connected
    ) {
      return;
    }

    sendBtn.disabled = true;

    socket.emit(
      "chat:send",
      {
        receiverId: selectedUser.id,
        content
      },
      (response) => {
        sendBtn.disabled = false;

        if (response?.ok) {
          messageInput.value = "";

          messageInput.focus();
        } else {
          alert(
            response?.error ||
            "Không gửi được tin nhắn."
          );
        }
      }
    );
  }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {
    try {
      if (socket) {
        socket.disconnect();
        socket = null;
      }

      await fetch(
        "/api/logout",
        {
          method: "POST"
        }
      );

    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

    } finally {
      window.location.reload();
    }
  }
);


/* =========================================================
   KHỞI ĐỘNG
========================================================= */

setMode("login");

initChat();
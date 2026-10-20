let mode = "login";
let me = null;
let selectedUser = null;
let socket = null;

const authView = document.getElementById("authView");
const chatView = document.getElementById("chatView");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authForm = document.getElementById("authForm");
const submitBtn = document.getElementById("submitBtn");
const authMsg = document.getElementById("authMsg");
const usersList = document.getElementById("usersList");
const messagesBox = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatTitle = document.getElementById("chatTitle");
const meName = document.getElementById("meName");

function setMode(next) {
  mode = next;
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  submitBtn.textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  authMsg.textContent = "";
}
loginTab.onclick = () => setMode("login");
registerTab.onclick = () => setMode("register");

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const url = mode === "login" ? "/api/login" : "/api/register";
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({username,password})
  });
  const data = await res.json();
  if (!res.ok) {
    authMsg.textContent = data.error || "Có lỗi xảy ra";
    return;
  }
  if (mode === "register") {
    authMsg.textContent = "Đăng ký thành công. Hãy đăng nhập.";
    setMode("login");
    return;
  }
  await initChat();
};

async function initChat() {
  const res = await fetch("/api/me");
  const data = await res.json();
  me = data.user;
  if (!me) return;
  authView.classList.add("hidden");
  chatView.classList.remove("hidden");
  meName.textContent = me.username;
  await loadUsers();

  socket = io();
  socket.on("chat:message", (msg) => {
    if (!selectedUser) return;
    const involved = (msg.sender_id === me.id && msg.receiver_id === selectedUser.id)
      || (msg.receiver_id === me.id && msg.sender_id === selectedUser.id);
    if (involved) appendMessage(msg);
  });
}

async function loadUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) return;
  const users = await res.json();
  usersList.innerHTML = "";
  users.forEach(u => {
    const item = document.createElement("div");
    item.className = "user-item";
    item.textContent = u.username;
    item.onclick = () => selectUser(u, item);
    usersList.appendChild(item);
  });
}

async function selectUser(user, item) {
  selectedUser = user;
  [...document.querySelectorAll(".user-item")].forEach(x => x.classList.remove("active"));
  item.classList.add("active");
  chatTitle.textContent = `Chat với ${user.username}`;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messagesBox.innerHTML = "";
  const res = await fetch(`/api/messages/${user.id}`);
  const messages = await res.json();
  messages.forEach(appendMessage);
  messageInput.focus();
}

function appendMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg" + (msg.sender_id === me.id ? " mine" : "");
  const content = document.createElement("div");
  content.textContent = msg.content;
  const meta = document.createElement("div");
  meta.className = "meta";
  const date = new Date(msg.created_at);
  meta.textContent = `${msg.sender_id === me.id ? "Bạn" : (msg.sender_name || selectedUser?.username || "User")} • ${date.toLocaleString()}`;
  div.appendChild(content);
  div.appendChild(meta);
  messagesBox.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

messageForm.onsubmit = (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!selectedUser || !content || !socket) return;
  socket.emit("chat:send", {receiverId:selectedUser.id,content}, (resp) => {
    if (resp?.ok) messageInput.value = "";
  });
};

document.getElementById("logoutBtn").onclick = async () => {
  await fetch("/api/logout", {method:"POST"});
  location.reload();
};

initChat();

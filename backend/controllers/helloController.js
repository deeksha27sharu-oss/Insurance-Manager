export const getRoot = (req, res) => {
  res.json({
    status: "ok",
    message: "insurance portal is running",
    endpoint: "/api/hello",
  });
};

export const getHello = (req, res) => {
  res.json({ message: "Hello from node" });
};
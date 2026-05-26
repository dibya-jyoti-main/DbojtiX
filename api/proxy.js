export default async function handler(req, res) {

  try {

    const BASE = process.env.API_URL;

    const target = req.query.path || "";

    const response = await fetch(`${BASE}/${target}`);

    const contentType =
      response.headers.get("content-type") || "application/json";

    const data = await response.text();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.status(response.status).send(data);

  } catch (err) {

    res.status(500).json({
      error: "Proxy Error"
    });

  }

}

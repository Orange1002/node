import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    res.send("優惠卷列表頁");
});

router.get("/add", (req, res) => {
    res.send("優惠卷新增畫面");
});

router.post("/add", (req, res) => {
    res.send("優惠卷新增主要程式");
});

router.get("/update", (req, res) => {
    res.send("優惠卷修改畫面");
});

router.get("/:id", (req, res) => {
    res.send("優惠卷詳細資料頁");
});

router.put("/update", (req, res) => {
    res.send("優惠卷修改主要程式");
});

router.delete("/delete", (req, res) => {
    res.send("優惠卷刪除主要程式");
});

export default router;
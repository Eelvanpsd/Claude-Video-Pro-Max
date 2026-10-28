// 全球累计装机容量（GW），IRENA (2026) Renewable Energy Statistics，经 Our World in Data 整理（CC BY 4.0）
// 太阳能 = 光伏 + 光热，并网 + 离网；风电 = 陆上 + 海上。原始 CSV 在 data/，下载于 2026-10-16。
export const YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const SOLAR = [178.84773, 226.5979, 298.50723, 392.3427, 487.84647, 590.1197, 721.2222, 865.921, 1057.8683, 1423.988, 1883.1776, 2396.7092];
export const WIND = [349.49323, 416.38437, 467.3158, 514.97186, 563.5159, 623.076, 733.2712, 824.1905, 903.0115, 1018.3177, 1132.5869, 1291.015];
export const GW_PER_SHEET = 10;     // 一片 = 10 GW（两种材料同一个单位，比例才可比）
export const BRASS_EVERY = 10;      // 每第 10 片换成黄铜 = 每 100 GW 一道刻度
export const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

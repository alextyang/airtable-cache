import { NextRequest } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let cache: { [key: string]: string } = {};
let timestamps: { [key: string]: number } = {};

export async function GET(request: NextRequest) {
    const { searchParams, pathname } = request.nextUrl;
    // Extract path segments from the pathname
    let path = pathname
        .replace(/^\/app\/|\/$/g, "") // Remove leading '/app/' and trailing '/'
        .split("/")
        .filter(Boolean);

    if (!path || path.length === 0) {
        path = [""]; // Handle the case where no path is provided
    }

    const url = `https://api.airtable.com/v0/${path.join("/")}?${searchParams.toString()}`;
    console.log("\n\n[API] Request: " + decodeURIComponent(url));

    let data: any;

    if (cache[url]) {
        console.log("\n[API] Cache hit for URL:", decodeURIComponent(url));
        data = cache[url];

        const lastUpdated = timestamps[url] || 0;
        if (Date.now() - lastUpdated > REFRESH_INTERVAL)
            refreshCache(url);

        return new Response(data, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    console.log("\n[API] Cache miss for URL:", decodeURIComponent(url));

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    data = await response.json();

    if (response.ok) {
        cache[url] = data;
        timestamps[url] = Date.now();
    }

    saveCache();

    console.log("[API] Response: ", response.status);

    return new Response(JSON.stringify(data),
        {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}

async function saveCache() {
    const cacheString = JSON.stringify(cache);
    const fs = require('fs');
    const path = require('path');
    const cacheFilePath = path.join(process.cwd(), 'public', 'cache.json');

    fs.writeFileSync(cacheFilePath, cacheString, 'utf8');
    console.log("[API] Cache saved to", cacheFilePath);
}

async function refreshCache(url: string) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (response.ok) {
        cache[url] = JSON.stringify(data);
        timestamps[url] = Date.now();
        console.log("[API] Cache refreshed for URL:", decodeURIComponent(url));
    }

    saveCache();
}

// http://localhost:4444/appHcZTzlfXAJpL7I/tblm2TqCcDcx94nA2?filterByFormula=OR(FIND(%27Cohort%2010%27%2C%20ARRAYJOIN(%7BCohort%7D%2C%20%27%2C%27))%20%3E%200%2C%20%7BCohort%7D%20%3D%20%27Cohort%2010%27%2CFIND(%27Cohort%2011%27%2C%20ARRAYJOIN(%7BCohort%7D%2C%20%27%2C%27))%20%3E%200%2C%20%7BCohort%7D%20%3D%20%27Cohort%2011%27%2CFIND(%27Cohort%2012%27%2C%20ARRAYJOIN(%7BCohort%7D%2C%20%27%2C%27))%20%3E%200%2C%20%7BCohort%7D%20%3D%20%27Cohort%2012%27)
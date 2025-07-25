// src/tools/notion-property-checker.ts
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function checkDatabaseProperties() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const database = await notion.databases.retrieve({ database_id: databaseId });
    
    console.log('📋 Notion 데이터베이스 속성 목록:\n');
    console.log('속성명 | 타입');
    console.log('------|------');
    
    Object.entries(database.properties).forEach(([name, prop]) => {
      console.log(`${name} | ${prop.type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabaseProperties();